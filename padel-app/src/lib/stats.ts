import type { Match, Player, PlayerStats } from '../types'

/**
 * Compute stats for a list of players given a set of matches.
 * totalSessions is the number of sessions in the season (for attendance %).
 * Pass 0 for session/night mode (attendance not applicable).
 */
export function computeStats(
  players: Player[],
  matches: Match[],
  totalSessions: number = 0,
  seasonMode: boolean = false,
): PlayerStats[] {
  const statMap = new Map<string, {
    matchesPlayed: number
    wins: number
    losses: number
    pointDiff: number
    totalPointsScored: number
    sessionsAttended: Set<string>
  }>()

  for (const p of players) {
    statMap.set(p.id, { matchesPlayed: 0, wins: 0, losses: 0, pointDiff: 0, totalPointsScored: 0, sessionsAttended: new Set() })
  }

  for (const match of matches) {
    const team1 = [match.team1_p1, match.team1_p2]
    const team2 = [match.team2_p1, match.team2_p2]
    const team1Won = match.team1_score > match.team2_score
    const diff1 = match.team1_score - match.team2_score
    const diff2 = match.team2_score - match.team1_score

    for (const pid of team1) {
      const s = statMap.get(pid)
      if (!s) continue
      s.matchesPlayed++
      s.totalPointsScored += match.team1_score
      s.pointDiff += diff1
      s.sessionsAttended.add(match.session_id)
      if (team1Won) s.wins++; else s.losses++
    }
    for (const pid of team2) {
      const s = statMap.get(pid)
      if (!s) continue
      s.matchesPlayed++
      s.totalPointsScored += match.team2_score
      s.pointDiff += diff2
      s.sessionsAttended.add(match.session_id)
      if (!team1Won) s.wins++; else s.losses++
    }
  }

  const results: PlayerStats[] = players
    .filter(p => statMap.has(p.id))
    .map(player => {
      const s = statMap.get(player.id)!
      const winRate = s.matchesPlayed > 0 ? s.wins / s.matchesPlayed : 0
      const avgPointDiff = s.matchesPlayed > 0 ? s.pointDiff / s.matchesPlayed : 0
      const attendancePct = seasonMode && totalSessions > 0
        ? s.sessionsAttended.size / totalSessions
        : 1

      return {
        player,
        matchesPlayed: s.matchesPlayed,
        wins: s.wins,
        losses: s.losses,
        winRate,
        pointDiff: s.pointDiff,
        totalPointsScored: s.totalPointsScored,
        avgPointDiff,
        attendancePct,
        lowAttendance: seasonMode && attendancePct < 0.5,
        rankScore: 0, // computed below
      }
    })
    .filter(s => s.matchesPlayed > 0)

  // Normalize avgPointDiff for ranking
  const diffs = results.map(r => r.avgPointDiff)
  const maxDiff = Math.max(...diffs, 1)
  const minDiff = Math.min(...diffs, 0)
  const range = maxDiff - minDiff || 1

  for (const r of results) {
    const normalizedDiff = (r.avgPointDiff - minDiff) / range
    r.rankScore = r.winRate * 0.5 + normalizedDiff * 0.5
  }

  // Sort: wins DESC, then pointDiff DESC
  results.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.pointDiff - a.pointDiff
  })

  return results
}

/**
 * For season standings, eligible (50%+ attendance) players come first,
 * ineligible are still shown in their rank position but flagged.
 */
export function sortSeasonStandings(stats: PlayerStats[]): PlayerStats[] {
  const eligible = stats.filter(s => !s.lowAttendance)
  const ineligible = stats.filter(s => s.lowAttendance)
  return [...eligible, ...ineligible]
}
