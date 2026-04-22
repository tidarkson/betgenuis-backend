import { NextResponse } from "next/server"
import {
  assertSyncSecret,
  createServiceRoleClient,
  parseDateFromRequest,
} from "@/lib/picks/settlement"

type PickPayload = {
  matchId?: string
  homeTeam?: string
  awayTeam?: string
  competition?: string
  pick?: string
  market?: string
  odds?: number
  confidence?: number
  risk?: string
  reasoning?: string
  time?: string
}

function getPickSourceBaseUrl(request: Request): string {
  const configured = process.env.PICKS_SOURCE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL

  if (configured) {
    return configured.replace(/\/$/, "")
  }

  return new URL(request.url).origin
}

function mapKickoffTime(date: string, time?: string): string | null {
  if (!time) {
    return null
  }

  const parsedTime = time.trim()
  if (!/^\d{2}:\d{2}$/.test(parsedTime)) {
    return null
  }

  return new Date(`${date}T${parsedTime}:00.000Z`).toISOString()
}

export async function POST(request: Request) {
  try {
    const authError = assertSyncSecret(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { date?: string }
    const date = body.date || parseDateFromRequest(request)

    const sourceBaseUrl = getPickSourceBaseUrl(request)
    const sourceUrl = `${sourceBaseUrl}/api/picks?date=${encodeURIComponent(date)}`

    const upstreamResponse = await fetch(sourceUrl, { cache: "no-store" })
    if (!upstreamResponse.ok) {
      const upstreamText = await upstreamResponse.text().catch(() => "")
      throw new Error(`Failed to fetch picks from ${sourceUrl}: ${upstreamResponse.status} ${upstreamText}`)
    }

    const payload = (await upstreamResponse.json()) as unknown
    const rawPicks = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)
        ? (payload as { data: unknown[] }).data
        : []

    const picks = rawPicks as PickPayload[]
    const now = new Date().toISOString()

    const rows = picks
      .filter((pick) => pick.pick && pick.market && pick.homeTeam && pick.awayTeam)
      .map((pick) => {
        const fixtureId = Number(pick.matchId)

        return {
          match_id: pick.matchId ?? null,
          api_fixture_id: Number.isFinite(fixtureId) ? fixtureId : null,
          home_team: String(pick.homeTeam),
          away_team: String(pick.awayTeam),
          competition: pick.competition ?? null,
          pick: String(pick.pick),
          market: String(pick.market),
          odds: Number(pick.odds ?? 0),
          confidence: Number.isFinite(Number(pick.confidence)) ? Number(pick.confidence) : null,
          risk: pick.risk ?? null,
          reasoning: pick.reasoning ?? null,
          kickoff_time: mapKickoffTime(date, pick.time),
          published_at: now,
          result: null,
          profit_loss: null,
        }
      })
      .filter((row) => Number.isFinite(row.odds) && row.odds > 1)

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, date, inserted: 0, sourceUrl })
    }

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("pick_records")
      .upsert(rows, { onConflict: "api_fixture_id,market", ignoreDuplicates: true })
      .select("id")

    if (error) {
      throw new Error(`Failed to insert pick records: ${error.message}`)
    }

    return NextResponse.json({
      ok: true,
      date,
      sourceUrl,
      fetched: picks.length,
      inserted: data?.length ?? 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
