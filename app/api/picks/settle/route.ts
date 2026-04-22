import { NextResponse } from "next/server"
import { fetchFixturesByDate } from "@/lib/api/sports-api"
import {
  assertSyncSecret,
  createServiceRoleClient,
  getProfitLoss,
  parseDateFromRequest,
  pickResultFromScore,
  recomputeKpiSnapshots,
} from "@/lib/picks/settlement"

type PickRecordRow = {
  id: string
  api_fixture_id: number
  pick: string
  odds: number
}

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"])

export async function POST(request: Request) {
  try {
    const authError = assertSyncSecret(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { date?: string }
    const date = body.date || parseDateFromRequest(request)

    const fixtures = await fetchFixturesByDate(date)
    const finishedFixtures = fixtures.filter((fixture) => FINISHED_STATUSES.has(fixture.fixture.status.short))

    if (finishedFixtures.length === 0) {
      const supabase = createServiceRoleClient()
      await recomputeKpiSnapshots(supabase)
      return NextResponse.json({ ok: true, date, settled: 0, finishedFixtures: 0 })
    }

    const fixtureById = new Map(finishedFixtures.map((fixture) => [fixture.fixture.id, fixture]))
    const fixtureIds = Array.from(fixtureById.keys())

    const supabase = createServiceRoleClient()
    const { data: unsettledRows, error: unsettledError } = await supabase
      .from("pick_records")
      .select("id, api_fixture_id, pick, odds")
      .is("result", null)
      .in("api_fixture_id", fixtureIds)

    if (unsettledError) {
      throw new Error(`Failed to fetch unsettled pick records: ${unsettledError.message}`)
    }

    const nowIso = new Date().toISOString()
    let settledCount = 0

    for (const row of (unsettledRows ?? []) as PickRecordRow[]) {
      const fixture = fixtureById.get(row.api_fixture_id)
      if (!fixture) {
        continue
      }

      const homeScore = fixture.goals.home
      const awayScore = fixture.goals.away

      if (homeScore === null || awayScore === null) {
        continue
      }

      const result = pickResultFromScore(row.pick, homeScore, awayScore)
      const profitLoss = getProfitLoss(result, Number(row.odds))

      const { error: updateError } = await supabase
        .from("pick_records")
        .update({
          result,
          profit_loss: profitLoss,
          settled_at: nowIso,
        })
        .eq("id", row.id)

      if (updateError) {
        throw new Error(`Failed to settle pick ${row.id}: ${updateError.message}`)
      }

      settledCount += 1
    }

    await recomputeKpiSnapshots(supabase)

    return NextResponse.json({
      ok: true,
      date,
      finishedFixtures: finishedFixtures.length,
      unsettledCandidates: unsettledRows?.length ?? 0,
      settled: settledCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
