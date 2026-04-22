import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

type AttributionSource = "telegram" | "facebook" | "twitter" | "direct"

function parseAttributionSource(value: string | null): AttributionSource {
  if (value === "telegram" || value === "facebook" || value === "twitter") {
    return value
  }

  return "direct"
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim()
    if (firstIp) return firstIp
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp

  const cfConnectingIp = request.headers.get("cf-connecting-ip")
  if (cfConnectingIp) return cfConnectingIp

  return "unknown"
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex")
}

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey)
}

function buildLinkvertiseUrl(targetUrl: string) {
  const apiKey = process.env.LINKVERTISE_API_KEY

  if (!apiKey) {
    return targetUrl
  }

  const encodedTarget = encodeURIComponent(targetUrl)
  return `https://link-target.net/${apiKey}/${encodedTarget}`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params
  const requestUrl = new URL(request.url)
  const source = parseAttributionSource(requestUrl.searchParams.get("source"))
  const userAgent = request.headers.get("user-agent")
  const ipHash = hashIp(getClientIp(request))

  const supabase = await createClient()
  const { data: streamLink } = await supabase
    .from("stream_links")
    .select("id, url")
    .eq("match_id", matchId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const fallbackBase = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const fallbackUrl = `${fallbackBase}/watch?match=${encodeURIComponent(matchId)}`
  const targetUrl = streamLink?.url ?? fallbackUrl

  const supabaseAdmin = getServiceRoleClient()

  if (streamLink?.id && supabaseAdmin) {
    void supabaseAdmin
      .from("click_events")
      .insert({
        match_id: matchId,
        stream_link_id: streamLink.id,
        source,
        user_agent: userAgent,
        ip_hash: ipHash,
      })
      .then(() =>
        supabaseAdmin.rpc("increment_click_count", {
          link_id: streamLink.id,
        }),
      )
      .catch((error) => {
        console.error("redirect analytics error", error)
      })
  }

  const redirectUrl = buildLinkvertiseUrl(targetUrl)

  return NextResponse.redirect(redirectUrl, { status: 307 })
}