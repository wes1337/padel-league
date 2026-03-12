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
    currentStreak: number
  }>()

  for (const p of players) {
    statMap.set(p.id, { matchesPlayed: 0, wins: 0, losses: 0, pointDiff: 0, totalPointsScored: 0, sessionsAttended: new Set(), currentStreak: 0 })
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

  // Compute current streak per player (chronological order)
  const sortedMatches = [...matches].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  for (const player of players) {
    const s = statMap.get(player.id)
    if (!s) continue
    const playerMatches = sortedMatches.filter(m =>
      [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2].includes(player.id)
    )
    let streak = 0
    for (let i = playerMatches.length - 1; i >= 0; i--) {
      const m = playerMatches[i]
      const onTeam1 = m.team1_p1 === player.id || m.team1_p2 === player.id
      const won = onTeam1 ? m.team1_score > m.team2_score : m.team2_score > m.team1_score
      if (streak === 0) {
        streak = won ? 1 : -1
      } else if (won && streak > 0) {
        streak++
      } else if (!won && streak < 0) {
        streak--
      } else {
        break
      }
    }
    s.currentStreak = streak
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
        lowAttendance: seasonMode && attendancePct >= 0.3 && attendancePct <= 0.5,
        rankScore: 0,
        currentStreak: s.currentStreak,
      }
    })
    .filter(s => s.matchesPlayed > 0 && !(seasonMode && s.attendancePct < 0.3))

  // Normalize avgPointDiff for rankScore
  const diffs = results.map(r => r.avgPointDiff)
  const maxDiff = Math.max(...diffs, 1)
  const minDiff = Math.min(...diffs, 0)
  const range = maxDiff - minDiff || 1

  for (const r of results) {
    const normalizedDiff = (r.avgPointDiff - minDiff) / range
    r.rankScore = r.winRate * 0.5 + normalizedDiff * 0.5
  }

  // Sort: eligible players first (win rate DESC, point diff as tiebreaker)
  // Low attendance players ranked after eligible players
  results.sort((a, b) => {
    if (a.lowAttendance !== b.lowAttendance) return a.lowAttendance ? 1 : -1
    if (b.winRate !== a.winRate) return b.winRate - a.winRate
    return b.pointDiff - a.pointDiff
  })

  return results
}
