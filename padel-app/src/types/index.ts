export type ScoringType = 'americano' | 'traditional'

export interface League {
  id: string
  name: string
  admin_token?: string
  created_at: string
}

export interface Player {
  id: string
  league_id: string
  name: string
  created_at: string
}

export interface Session {
  id: string
  league_id: string
  date: string
  label: string | null
  excluded: boolean
  pin: string | null
  confirmed: boolean
  ended: boolean
  creator_token: string | null
  created_at: string
}

export interface Match {
  id: string
  session_id: string
  scoring_type: ScoringType
  team1_p1: string
  team1_p2: string
  team2_p1: string
  team2_p2: string
  team1_score: number
  team2_score: number
  created_at: string
}

export interface PlayerStats {
  player: Player
  matchesPlayed: number
  wins: number
  losses: number
  winRate: number
  pointDiff: number
  totalPointsScored: number
  avgPointDiff: number
  attendancePct: number
  lowAttendance: boolean
  rankScore: number
  currentStreak: number
}
