import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchFixturesByDate } from "@/lib/api/sports-api"

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { date?: string }
    const date = body.date ?? new Date().toISOString().slice(0, 10)

    const fixtures = await fetchFixturesByDate(date)
    const supabase = await createClient()
    const { error } = await supabase.from("fixtures_import_queue").upsert(fixtures, {
      onConflict: "external_id",
    })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ ok: true, imported: fixtures.length, date })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}