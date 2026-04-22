import { createClient } from "@supabase/supabase-js"

export type SettleResult = "WIN" | "LOSS" | "VOID"
export type SnapshotPeriod = "all_time" | "7d" | "30d"

type SnapshotMetrics = {
  totalPicks: number
  won: number
  lost: number
  voided: number
  winRate: number
  roi: number
  profitUnits: number
  currentStreak: number
  streakType: SettleResult | null
}

type PickResultRow = {
  result: SettleResult | null
  profit_loss: number | string | null
}

const PERIODS: SnapshotPeriod[] = ["all_time", "7d", "30d"]

export function parseDateFromRequest(request: Request, fallbackDate?: string) {
  const fallback = fallbackDate ?? new Date().toISOString().slice(0, 10)
  const requestUrl = new URL(request.url)
  const queryDate = requestUrl.searchParams.get("date")

  return queryDate || fallback
}

export function assertSyncSecret(request: Request): string | null {
  const secret = process.env.SYNC_SECRET
  const authHeader = request.headers.get("authorization")

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return "Unauthorized"
  }

  return null
}

export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

export function pickResultFromScore(pick: string, homeScore: number, awayScore: number): SettleResult {
  const normalizedPick = pick.trim().toLowerCase().replace(/\s+/g, " ")

  if (normalizedPick === "home win" || normalizedPick === "1") {
    return homeScore > awayScore ? "WIN" : "LOSS"
  }

  if (normalizedPick === "away win" || normalizedPick === "2") {
    return awayScore > homeScore ? "WIN" : "LOSS"
  }

  if (normalizedPick === "draw" || normalizedPick === "x") {
    return homeScore === awayScore ? "WIN" : "LOSS"
  }

  if (normalizedPick === "over 2.5" || normalizedPick === "over2.5") {
    return homeScore + awayScore > 2.5 ? "WIN" : "LOSS"
  }

  if (
    normalizedPick === "btts yes" ||
    normalizedPick === "both teams to score yes" ||
    normalizedPick === "gg"
  ) {
    return homeScore > 0 && awayScore > 0 ? "WIN" : "LOSS"
  }

  return "VOID"
}

export function getProfitLoss(result: SettleResult, odds: number): number {
  if (result === "WIN") {
    return Number((odds - 1).toFixed(2))
  }

  if (result === "LOSS") {
    return -1
  }

  return 0
}

function toNumber(value: number | string | null): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function toRounded2(value: number): number {
  return Number(value.toFixed(2))
}

function calculateStreak(results: SettleResult[]): { currentStreak: number; streakType: SettleResult | null } {
  if (results.length === 0) {
    return { currentStreak: 0, streakType: null }
  }

  const streakType = results[0]
  let currentStreak = 1

  for (let index = 1; index < results.length; index += 1) {
    if (results[index] !== streakType) {
      break
    }

    currentStreak += 1
  }

  return { currentStreak, streakType }
}

function aggregateSnapshot(rows: PickResultRow[]): SnapshotMetrics {
  const settledRows = rows.filter((row) => row.result !== null)
  const totalPicks = settledRows.length

  const won = settledRows.filter((row) => row.result === "WIN").length
  const lost = settledRows.filter((row) => row.result === "LOSS").length
  const voided = settledRows.filter((row) => row.result === "VOID").length

  const profitUnits = toRounded2(settledRows.reduce((sum, row) => sum + toNumber(row.profit_loss), 0))

  const winRate = totalPicks > 0 ? toRounded2((won / totalPicks) * 100) : 0
  const roi = totalPicks > 0 ? toRounded2((profitUnits / totalPicks) * 100) : 0

  const recentResults = settledRows
    .map((row) => row.result)
    .filter((result): result is SettleResult => result !== null)

  const { currentStreak, streakType } = calculateStreak(recentResults)

  return {
    totalPicks,
    won,
    lost,
    voided,
    winRate,
    roi,
    profitUnits,
    currentStreak,
    streakType,
  }
}

export async function recomputeKpiSnapshots(supabase: ReturnType<typeof createServiceRoleClient>) {
  for (const period of PERIODS) {
    let query = supabase
      .from("pick_records")
      .select("result, profit_loss")
      .not("result", "is", null)
      .order("settled_at", { ascending: false })

    if (period !== "all_time") {
      const days = period === "7d" ? 7 : 30
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte("settled_at", cutoff)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to compute ${period} KPI snapshot: ${error.message}`)
    }

    const metrics = aggregateSnapshot((data ?? []) as PickResultRow[])

    const { error: upsertError } = await supabase.from("kpi_snapshots").upsert(
      {
        period,
        total_picks: metrics.totalPicks,
        won: metrics.won,
        lost: metrics.lost,
        voided: metrics.voided,
        win_rate: metrics.winRate,
        roi: metrics.roi,
        profit_units: metrics.profitUnits,
        current_streak: metrics.currentStreak,
        streak_type: metrics.streakType,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "period" },
    )

    if (upsertError) {
      throw new Error(`Failed to upsert ${period} KPI snapshot: ${upsertError.message}`)
    }
  }
}
