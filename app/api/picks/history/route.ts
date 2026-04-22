import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get("limit")
    const limit = limitParam ? Number(limitParam) : 7

    if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("pick_records")
      .select(
        "id, match_id, api_fixture_id, home_team, away_team, competition, pick, market, odds, confidence, risk, reasoning, kickoff_time, published_at, settled_at, result, profit_loss, created_at",
      )
      .not("result", "is", null)
      .order("settled_at", { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch picks history: ${error.message}`)
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
