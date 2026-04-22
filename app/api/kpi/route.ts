import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Period = "all_time" | "7d" | "30d"

const PERIODS = new Set<Period>(["all_time", "7d", "30d"])

export const revalidate = 300

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get("period") ?? "30d") as Period

    if (!PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period. Use all_time, 7d or 30d." }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("kpi_snapshots")
      .select(
        "period, total_picks, won, lost, voided, win_rate, roi, profit_units, current_streak, streak_type, last_updated",
      )
      .eq("period", period)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch KPI snapshot: ${error.message}`)
    }

    const payload = {
      winRate: Number(data?.win_rate ?? 0),
      totalPicks: Number(data?.total_picks ?? 0),
      won: Number(data?.won ?? 0),
      lost: Number(data?.lost ?? 0),
      roi: Number(data?.roi ?? 0),
      profitUnits: Number(data?.profit_units ?? 0),
      currentStreak: Number(data?.current_streak ?? 0),
      streakType: data?.streak_type ?? null,
      lastUpdated: data?.last_updated ?? null,
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
