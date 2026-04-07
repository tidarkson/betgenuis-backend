import { NextResponse } from "next/server"
import { listMatches } from "@/lib/api/matches"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get("limit")
    const limit = limitParam ? Number(limitParam) : 30

    if (!Number.isFinite(limit) || limit < 1 || limit > 200) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 })
    }

    const matches = await listMatches(limit)
    return NextResponse.json({ data: matches })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}