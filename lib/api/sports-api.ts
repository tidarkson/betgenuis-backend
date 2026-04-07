import axios from "axios"

interface ApiFootballFixture {
  fixture: {
    id: number
    date: string
    venue?: {
      name?: string | null
    }
    status: {
      short: string
    }
  }
  league: {
    id: number
    name: string
    country?: string | null
    logo?: string | null
  }
  teams: {
    home: {
      id: number
      name: string
      logo?: string | null
    }
    away: {
      id: number
      name: string
      logo?: string | null
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
}

interface ApiFootballResponse {
  response: ApiFootballFixture[]
}

function mapStatus(short: string): "scheduled" | "live" | "finished" | "postponed" | "cancelled" {
  if (["1H", "2H", "HT", "ET", "BT", "P", "INT", "LIVE"].includes(short)) {
    return "live"
  }
  if (["FT", "AET", "PEN"].includes(short)) {
    return "finished"
  }
  if (["PST"].includes(short)) {
    return "postponed"
  }
  if (["CANC", "ABD", "AWD", "WO"].includes(short)) {
    return "cancelled"
  }
  return "scheduled"
}

export async function fetchFixturesByDate(date: string) {
  const apiKey = process.env.SPORTS_API_KEY

  if (!apiKey) {
    throw new Error("Missing SPORTS_API_KEY")
  }

  const { data } = await axios.get<ApiFootballResponse>("https://v3.football.api-sports.io/fixtures", {
    params: { date },
    headers: {
      "x-apisports-key": apiKey,
    },
  })

  return data.response.map((item) => ({
    external_id: String(item.fixture.id),
    slug: `match-${item.fixture.id}`,
    kickoff_at: item.fixture.date,
    status: mapStatus(item.fixture.status.short),
    competition_name: item.league.name,
    competition_country: item.league.country ?? null,
    competition_logo_url: item.league.logo ?? null,
    home_team_name: item.teams.home.name,
    home_team_logo_url: item.teams.home.logo ?? null,
    away_team_name: item.teams.away.name,
    away_team_logo_url: item.teams.away.logo ?? null,
    score_home: item.goals.home,
    score_away: item.goals.away,
    venue: item.fixture.venue?.name ?? null,
  }))
}