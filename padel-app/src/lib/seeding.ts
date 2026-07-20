import type { Match, Player } from '../types'
import { computeStats } from './stats'
import { courtLabel } from './courts'

// Where a player's seed position came from — surfaced in the UI so it's clear
// why someone starts on the top court.
export type SeedSource = 'lastweek' | 'season' | 'new'

export interface SeededPlayer {
  id: string | null // null = pasted name that isn't a league player yet
  name: string
  source: SeedSource
}

export interface Court {
  court: number // 1 = top court
  pair1: [SeededPlayer, SeededPlayer]
  pair2: [SeededPlayer, SeededPlayer]
}

export interface SeedingResult {
  courts: Court[]
  bench: SeededPlayer[] // lowest-ranked players who sit out game 1 (count not divisible by 4)
  unmatchedNames: string[] // pasted names with no matching league player
  ranked: SeededPlayer[] // full seeded order, best → worst
}

// Strip common WhatsApp list decoration ("1.", "- ", "• ", trailing ✅ etc.)
// so a copy-pasted attendance list resolves to plain names.
export function cleanNameLine(line: string): string {
  return line
    .replace(/^\s*\d+[.)]\s*/, '') // "1." / "1)"
    .replace(/^[\s\-*•·–—]+/, '') // leading bullets / dashes
    .replace(/[✅✔️☑️👍🎾➕]/g, '') // common marks
    .replace(/\s+/g, ' ')
    .trim()
}

// Split a pasted block (newline- or comma-separated) into candidate names.
export function parseNames(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map(cleanNameLine)
    .filter(n => n.length > 0)
}

/**
 * Suggest starting courts + pairs for the first game of a night.
 *
 * Ranking: players who were present last week are ordered by how they finished
 * last week's night (variety — results churn week to week). Anyone who missed
 * last week is slotted in by their season standing. Brand-new names start at the
 * bottom. Within each court of four (a > b > c > d) the pair is balanced so the
 * opening game is competitive, feeding the winners-up / losers-down ladder.
 *
 * `variant` cycles the within-court pairing for the reshuffle button:
 *   0 → a+d vs b+c (most balanced, default)
 *   1 → a+c vs b+d
 *   2 → a+b vs c+d (top-heavy)
 */
export function suggestStartingPairs(
  inputNames: string[],
  players: Player[],
  lastWeekMatches: Match[],
  seasonMatches: Match[],
  variant = 0,
): SeedingResult {
  // 1. Resolve pasted names → league players (case-insensitive, exact match).
  const byName = new Map<string, Player>()
  for (const p of players) byName.set(p.name.trim().toLowerCase(), p)

  const matched: Player[] = []
  const seenIds = new Set<string>()
  const unmatchedNames: string[] = []
  const seenUnmatched = new Set<string>()
  for (const raw of inputNames) {
    const key = raw.toLowerCase()
    const p = byName.get(key)
    if (p) {
      if (!seenIds.has(p.id)) { matched.push(p); seenIds.add(p.id) }
    } else if (!seenUnmatched.has(key)) {
      unmatchedNames.push(raw)
      seenUnmatched.add(key)
    }
  }

  // 2. Season ranking used to place subs and break last-week ties.
  //    Rank by SKILL (win rate → point diff), but only for players who show up at
  //    least MIN_ATTENDANCE of the season — a one-off big night shouldn't leapfrog
  //    regulars, yet a genuinely strong player who plays, say, half the sessions
  //    should still be seeded by how they actually play, not buried for turnout.
  //    (Deliberately looser than the season leaderboard, which penalises the
  //    30–50% band; here we only drop players below 30%.)
  const MIN_ATTENDANCE = 0.3
  const totalSessions = new Set(seasonMatches.map(m => m.session_id)).size
  const attended = new Map<string, Set<string>>()
  for (const m of seasonMatches) {
    for (const pid of [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2]) {
      if (!attended.has(pid)) attended.set(pid, new Set())
      attended.get(pid)!.add(m.session_id)
    }
  }
  const meetsFloor = (pid: string) =>
    totalSessions === 0 || (attended.get(pid)?.size ?? 0) / totalSessions >= MIN_ATTENDANCE
  const seasonRank = new Map<string, number>()
  computeStats(players, seasonMatches)
    .filter(s => meetsFloor(s.player.id))
    .forEach((s, i) => seasonRank.set(s.player.id, i))

  // Last week's finishing order. computeStats sorts by win rate → point diff, but
  // an EXACT tie (same win rate AND same point diff) would otherwise fall to name
  // order. Break those ties by season standing so court/team assignment reflects
  // who's actually better, not the alphabet. (Season rank: lower = better; a
  // player with no season rank sorts last among the tied.)
  const lastWeekStats = computeStats(players, lastWeekMatches)
  lastWeekStats.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff
    return (seasonRank.get(a.player.id) ?? Infinity) - (seasonRank.get(b.player.id) ?? Infinity)
  })
  const lastWeekRank = new Map<string, number>()
  lastWeekStats.forEach((s, i) => lastWeekRank.set(s.player.id, i))

  // 3. Build the seeded order.
  const ranked: SeededPlayer[] = matched
    .filter(p => lastWeekRank.has(p.id))
    .sort((a, b) => lastWeekRank.get(a.id)! - lastWeekRank.get(b.id)!)
    .map(p => ({ id: p.id, name: p.name, source: 'lastweek' as const }))

  // Absentees (missed last week but have season history) inserted by season rank.
  const absentees = matched
    .filter(p => !lastWeekRank.has(p.id) && seasonRank.has(p.id))
    .sort((a, b) => seasonRank.get(a.id)! - seasonRank.get(b.id)!)
  for (const p of absentees) {
    const sRank = seasonRank.get(p.id)!
    // Place the sub at the depth matching their season standing: below everyone
    // who outranks them, above everyone they outrank. Count ALL better-ranked
    // present players — don't stop at the first, because the attendees are in
    // last-week order (not season order), so the better-ranked players aren't
    // contiguous. Players with no season rank count as weaker than the sub.
    let idx = 0
    for (const r of ranked) {
      const os = r.id != null ? seasonRank.get(r.id) : undefined
      if (os !== undefined && os < sRank) idx++
    }
    ranked.splice(idx, 0, { id: p.id, name: p.name, source: 'season' })
  }

  // Newcomers (matched players with no history, then unmatched names) at the bottom.
  for (const p of matched) {
    if (!lastWeekRank.has(p.id) && !seasonRank.has(p.id)) {
      ranked.push({ id: p.id, name: p.name, source: 'new' })
    }
  }
  for (const name of unmatchedNames) ranked.push({ id: null, name, source: 'new' })

  // 4. Chunk into full courts of 4; leftover lowest-ranked players sit out game 1.
  const numCourts = Math.floor(ranked.length / 4)
  const bench = ranked.slice(numCourts * 4)
  const courts: Court[] = []
  for (let c = 0; c < numCourts; c++) {
    const [a, b, cc, d] = ranked.slice(c * 4, c * 4 + 4)
    courts.push({ court: c + 1, ...pairing(a, b, cc, d, variant) })
  }

  return { courts, bench, unmatchedNames, ranked }
}

function pairing(
  a: SeededPlayer, b: SeededPlayer, c: SeededPlayer, d: SeededPlayer, variant: number,
): { pair1: [SeededPlayer, SeededPlayer]; pair2: [SeededPlayer, SeededPlayer] } {
  switch (((variant % 3) + 3) % 3) {
    case 1: return { pair1: [a, c], pair2: [b, d] }
    case 2: return { pair1: [a, b], pair2: [c, d] }
    default: return { pair1: [a, d], pair2: [b, c] }
  }
}

// Plain-text block for pasting the line-up back into WhatsApp.
export function formatLineup(result: SeedingResult, leagueName?: string): string {
  const lines: string[] = []
  lines.push(`🎾 ${leagueName ? `${leagueName} — ` : ''}Starting courts`)
  lines.push('')
  for (const court of result.courts) {
    const p1 = `${court.pair1[0].name} & ${court.pair1[1].name}`
    const p2 = `${court.pair2[0].name} & ${court.pair2[1].name}`
    lines.push(`${courtLabel(court.court)}: ${p1}  vs  ${p2}`)
  }
  if (result.bench.length > 0) {
    lines.push('')
    lines.push(`Sitting out game 1: ${result.bench.map(p => p.name).join(', ')}`)
  }
  return lines.join('\n')
}
