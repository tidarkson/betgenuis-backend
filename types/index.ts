export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled"

export interface Competition {
  id: string
  slug: string
  name: string
  country?: string
  logoUrl?: string
}

export interface Team {
  id: string
  slug: string
  name: string
  shortName?: string
  logoUrl?: string
  country?: string
}

export interface StreamLink {
  id: string
  matchId: string
  sourceName: string
  sourceUrl: string
  isActive: boolean
  language?: string
  quality?: string
  createdAt: string
  updatedAt: string
}

export interface Match {
  id: string
  externalId?: string
  slug: string
  kickoffAt: string
  status: MatchStatus
  competitionId: string
  homeTeamId: string
  awayTeamId: string
  scoreHome?: number
  scoreAway?: number
  venue?: string
  competition?: Competition
  homeTeam?: Team
  awayTeam?: Team
  streamLinks?: StreamLink[]
}

export interface ContentQueueItem {
  id: string
  type: "blog_post" | "match_preview" | "social_snippet"
  status: "queued" | "processing" | "published" | "failed"
  matchId?: string
  blogPostId?: string
  scheduledAt?: string
  processedAt?: string
  error?: string
  createdAt: string
  updatedAt: string
}

export interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  coverImageUrl?: string
  matchId?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
  tags?: string[]
}