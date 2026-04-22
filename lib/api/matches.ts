import type { Match } from "@/types"
import { createClient } from "@/lib/supabase/server"

const MATCH_SELECT = `id, api_id, kickoff_time, status, competition_id, home_team_id, away_team_id, home_score, away_score, minute, venue, round, season, competition:competitions(id, name, slug, logo_url), home_team:teams!matches_home_team_id_fkey(id, name, slug, logo_url), away_team:teams!matches_away_team_id_fkey(id, name, slug, logo_url)`

function mapMatchRow(row: any): Match {
  return {
    id: String(row.id),
    apiId: row.api_id ? Number(row.api_id) : undefined,
    kickoffTime: row.kickoff_time,
    status: row.status,
    competitionId: String(row.competition_id),
    homeTeamId: String(row.home_team_id),
    awayTeamId: String(row.away_team_id),
    homeScore: row.home_score ?? undefined,
    awayScore: row.away_score ?? undefined,
    minute: row.minute ?? undefined,
    venue: row.venue ?? undefined,
    competition: row.competition
      ? {
          id: String(row.competition.id),
          name: row.competition.name,
          slug: row.competition.slug,
          logoUrl: row.competition.logo_url ?? undefined,
        }
      : undefined,
    homeTeam: row.home_team
      ? {
          id: String(row.home_team.id),
          name: row.home_team.name,
          slug: row.home_team.slug,
          logoUrl: row.home_team.logo_url ?? undefined,
        }
      : undefined,
    awayTeam: row.away_team
      ? {
          id: String(row.away_team.id),
          name: row.away_team.name,
          slug: row.away_team.slug,
          logoUrl: row.away_team.logo_url ?? undefined,
        }
      : undefined,
  }
}

export async function listMatches(limit = 30): Promise<Match[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .order("kickoff_time", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch matches: ${error.message}`)
  }

  return (data ?? []).map(mapMatchRow)
}

export async function getMatchById(id: string): Promise<Match | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch match by id: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return mapMatchRow(data)
}