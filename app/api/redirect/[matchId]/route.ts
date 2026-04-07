import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function buildLinkvertiseUrl(targetUrl: string) {
  const apiKey = process.env.LINKVERTISE_API_KEY

  if (!apiKey) {
    return targetUrl
  }

  const encodedTarget = encodeURIComponent(targetUrl)
  return `https://link-target.net/${apiKey}/${encodedTarget}`
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params

  const supabase = await createClient()
  const { data } = await supabase
    .from("stream_links")
    .select("source_url")
    .eq("match_id", matchId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const fallbackBase = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const fallbackUrl = `${fallbackBase}/watch?match=${encodeURIComponent(matchId)}`
  const targetUrl = data?.source_url ?? fallbackUrl
  const redirectUrl = buildLinkvertiseUrl(targetUrl)

  return NextResponse.redirect(redirectUrl, { status: 307 })
}