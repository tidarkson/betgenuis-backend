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

export type ApiFixture = ApiFootballFixture

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

  return data.response
}