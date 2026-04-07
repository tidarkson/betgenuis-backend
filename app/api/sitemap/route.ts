import { NextResponse } from "next/server"
import { listMatches } from "@/lib/api/matches"

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const staticPaths = ["/", "/schedule", "/predictions", "/picks", "/watch"]

  let matchPaths: string[] = []
  try {
    const matches = await listMatches(200)
    matchPaths = matches.map((match) => `/match/${match.id}`)
  } catch {
    matchPaths = []
  }

  const allPaths = [...staticPaths, ...matchPaths]
  const now = new Date().toISOString()

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPaths
  .map(
    (path) => `  <url>
    <loc>${xmlEscape(`${baseUrl}${path}`)}</loc>
    <lastmod>${now}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>`

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  })
}