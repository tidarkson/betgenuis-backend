import type { Match } from "@/types"
import { createClient } from "@/lib/supabase/server"

export async function listMatches(limit = 30): Promise<Match[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("matches")
    .select("id, external_id, slug, kickoff_at, status, competition_id, home_team_id, away_team_id, score_home, score_away, venue")
    .order("kickoff_at", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch matches: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    externalId: row.external_id ? String(row.external_id) : undefined,
    slug: row.slug,
    kickoffAt: row.kickoff_at,
    status: row.status,
    competitionId: String(row.competition_id),
    homeTeamId: String(row.home_team_id),
    awayTeamId: String(row.away_team_id),
    scoreHome: row.score_home ?? undefined,
    scoreAway: row.score_away ?? undefined,
    venue: row.venue ?? undefined,
  }))
}