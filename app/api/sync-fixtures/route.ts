import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { fetchFixturesByDate, type ApiFixture } from "@/lib/api/sports-api"

type CompetitionRow = {
  id: string
}

type TeamRow = {
  id: string
}

type MatchRow = {
  id: string
}

const RETRY_ATTEMPTS = 3

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function mapFixtureStatus(short: string): "scheduled" | "live" | "finished" | "postponed" {
  if (["1H", "2H", "HT", "ET", "P", "INT"].includes(short)) {
    return "live"
  }

  if (["FT", "AET", "PEN"].includes(short)) {
    return "finished"
  }

  if (["PST", "CANC", "ABD"].includes(short)) {
    return "postponed"
  }

  return "scheduled"
}

function getDateFromRequest(request: Request, fallbackDate: string) {
  const url = new URL(request.url)
  const queryDate = url.searchParams.get("date")
  if (queryDate) {
    return queryDate
  }

  return fallbackDate
}

async function withRetry(fn: () => Promise<any>, label: string): Promise<any> {
  let lastError: unknown
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!message.toLowerCase().includes("fetch failed") || attempt === RETRY_ATTEMPTS) {
        throw error
      }
      console.warn(`Retrying ${label} after transient failure (attempt ${attempt}/${RETRY_ATTEMPTS})`)
    }
  }
  throw lastError
}

async function upsertCompetitionByApiId(supabase: any, fixture: ApiFixture) {
  const apiId = fixture.league.id
  const payload = {
    api_id: apiId,
    name: fixture.league.name,
    slug: `${slugify(fixture.league.name)}-${apiId}`,
    logo_url: fixture.league.logo ?? null,
    country: fixture.league.country ?? null,
    season: String(new Date(fixture.fixture.date).getUTCFullYear()),
    is_active: true,
  }

  const { data: existing, error: findError } = await withRetry(
    () =>
      supabase
        .from("competitions")
        .select("id")
        .eq("api_id", apiId)
        .limit(1),
    `competition lookup ${apiId}`,
  )

  if (findError) {
    throw new Error(`Failed competition lookup for fixture ${fixture.fixture.id}: ${findError.message}`)
  }

  if (existing && existing.length > 0) {
    const competitionId = (existing[0] as CompetitionRow).id
    const { error: updateError } = await withRetry(
      () => supabase.from("competitions").update(payload as any).eq("id", competitionId),
      `competition update ${competitionId}`,
    )
    if (updateError) {
      throw new Error(`Failed competition update for fixture ${fixture.fixture.id}: ${updateError.message}`)
    }
    return competitionId
  }

  const { data: inserted, error: insertError } = await withRetry(
    () =>
      supabase
        .from("competitions")
        .insert(payload as any)
        .select("id")
        .single(),
    `competition insert ${apiId}`,
  )

  if (insertError) {
    throw new Error(`Failed competition insert for fixture ${fixture.fixture.id}: ${insertError.message}`)
  }

  return (inserted as CompetitionRow).id
}

async function upsertTeamByApiId(
  supabase: any,
  fixtureId: number,
  team: { id: number; name: string; logo?: string | null },
  side: "home" | "away",
) {
  const payload = {
    api_id: team.id,
    name: team.name,
    slug: `${slugify(team.name)}-${team.id}`,
    logo_url: team.logo ?? null,
  }

  const { data: existing, error: findError } = await withRetry(
    () =>
      supabase
        .from("teams")
        .select("id")
        .eq("api_id", team.id)
        .limit(1),
    `${side} team lookup ${team.id}`,
  )

  if (findError) {
    throw new Error(`Failed ${side} team lookup for fixture ${fixtureId}: ${findError.message}`)
  }

  if (existing && existing.length > 0) {
    const teamId = (existing[0] as TeamRow).id
    const { error: updateError } = await withRetry(
      () => supabase.from("teams").update(payload as any).eq("id", teamId),
      `${side} team update ${teamId}`,
    )
    if (updateError) {
      throw new Error(`Failed ${side} team update for fixture ${fixtureId}: ${updateError.message}`)
    }
    return teamId
  }

  const { data: inserted, error: insertError } = await withRetry(
    () =>
      supabase
        .from("teams")
        .insert(payload as any)
        .select("id")
        .single(),
    `${side} team insert ${team.id}`,
  )

  if (insertError) {
    throw new Error(`Failed ${side} team insert for fixture ${fixtureId}: ${insertError.message}`)
  }

  return (inserted as TeamRow).id
}

async function upsertMatchByApiId(
  supabase: any,
  fixture: ApiFixture,
  competitionId: string,
  homeTeamId: string,
  awayTeamId: string,
) {
  const payload = {
    api_id: fixture.fixture.id,
    competition_id: competitionId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    kickoff_time: fixture.fixture.date,
    status: mapFixtureStatus(fixture.fixture.status.short),
    home_score: fixture.goals.home,
    away_score: fixture.goals.away,
    venue: fixture.fixture.venue?.name ?? null,
    season: String(new Date(fixture.fixture.date).getUTCFullYear()),
    updated_at: new Date().toISOString(),
  }

  const { error: upsertError } = await withRetry(
    () => supabase.from("matches").upsert(payload as any, { onConflict: "api_id" }),
    `match upsert ${fixture.fixture.id}`,
  )
  if (upsertError) {
    throw new Error(`Failed match upsert for fixture ${fixture.fixture.id}: ${upsertError.message}`)
  }
}

async function syncFixtures(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    const secret = process.env.SYNC_SECRET
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as { date?: string }
    const date = body.date ?? getDateFromRequest(request, new Date().toISOString().slice(0, 10))

    const fixtures = await fetchFixturesByDate(date)
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const competitionCache = new Map<number, string>()
    const teamCache = new Map<number, string>()

    for (const fixture of fixtures as ApiFixture[]) {
      let competitionId = competitionCache.get(fixture.league.id)
      if (!competitionId) {
        competitionId = await upsertCompetitionByApiId(supabase, fixture)
        competitionCache.set(fixture.league.id, competitionId)
      }

      let homeTeamId = teamCache.get(fixture.teams.home.id)
      if (!homeTeamId) {
        homeTeamId = await upsertTeamByApiId(supabase, fixture.fixture.id, fixture.teams.home, "home")
        teamCache.set(fixture.teams.home.id, homeTeamId)
      }

      let awayTeamId = teamCache.get(fixture.teams.away.id)
      if (!awayTeamId) {
        awayTeamId = await upsertTeamByApiId(supabase, fixture.fixture.id, fixture.teams.away, "away")
        teamCache.set(fixture.teams.away.id, awayTeamId)
      }

      await upsertMatchByApiId(supabase, fixture, competitionId, homeTeamId, awayTeamId)
    }

    return NextResponse.json({ ok: true, imported: fixtures.length, date })
  } catch (error) {
    console.error("sync-fixtures failed", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return syncFixtures(request)
}

export async function GET(request: Request) {
  return syncFixtures(request)
}
