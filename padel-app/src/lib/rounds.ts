import type { Match } from '../types'

// A court in the next round. `ready` is true once both of the source-round games
// that feed it are scored — so a court can be formed the moment its inputs exist,
// without waiting for the whole round to finish.
export interface NextCourtSlot {
  court: number // 1 = top court
  ready: boolean
  pair1?: [string, string]
  pair2?: [string, string]
}

const key = (a: string, b: string) => [a, b].sort().join('|')
const isScored = (m: Match) => !(m.team1_score === 0 && m.team2_score === 0)
const winnerOf = (m: Match): [string, string] => (m.team1_score > m.team2_score ? [m.team1_p1, m.team1_p2] : [m.team2_p1, m.team2_p2])
const loserOf = (m: Match): [string, string] => (m.team1_score > m.team2_score ? [m.team2_p1, m.team2_p2] : [m.team1_p1, m.team1_p2])

/**
 * Plan the next round for a winner-court night, court by court.
 *
 * Movement: winners go up one court, losers down one; Court 1 winners and the
 * bottom court's losers stay. So each new court is fed by exactly two source
 * games — the pair dropping from above + the pair climbing from below (the top
 * and bottom courts mix in their own stayers). A court is `ready` as soon as
 * those two games are scored.
 *
 * When a court is ready, the two incoming pairs are split (never kept together)
 * and paired to (1) never recreate a partnership used tonight, then (2) minimise
 * repeat opponents.
 *
 * Pairing priority (highest first): never repeat a partnership from tonight →
 * avoid facing the same opponent again tonight → then, as a tiebreaker, prefer
 * pairings that are fresher over the whole season (partners, then opponents).
 *
 * @param sourceRound the round being advanced from, ordered by court (index 0 = top);
 *                    games may be scored or still 0–0.
 * @param history     every scored game so far tonight (for partner/opponent counts)
 * @param seasonHistory optional season-wide scored games, used only to break ties
 */
export function planNextRound(sourceRound: Match[], history: Match[], seasonHistory: Match[] = []): NextCourtSlot[] {
  const n = sourceRound.length
  if (n === 0) return []

  const counts = (games: Match[]) => {
    const p = new Map<string, number>(), o = new Map<string, number>()
    const bump = (map: Map<string, number>, a: string, b: string) => map.set(key(a, b), (map.get(key(a, b)) ?? 0) + 1)
    for (const m of games) {
      bump(p, m.team1_p1, m.team1_p2)
      bump(p, m.team2_p1, m.team2_p2)
      for (const x of [m.team1_p1, m.team1_p2]) for (const y of [m.team2_p1, m.team2_p2]) bump(o, x, y)
    }
    return { p, o }
  }
  const tonight = counts(history)
  const season = counts(seasonHistory)
  const P = (a: string, b: string) => tonight.p.get(key(a, b)) ?? 0
  const O = (a: string, b: string) => tonight.o.get(key(a, b)) ?? 0
  const SP = (a: string, b: string) => season.p.get(key(a, b)) ?? 0
  const SO = (a: string, b: string) => season.o.get(key(a, b)) ?? 0

  const out: NextCourtSlot[] = []
  for (let i = 0; i < n; i++) {
    // Which two source games feed this court, and whether we take their winners.
    let gA: number, gB: number, aWin: boolean, bWin: boolean
    if (n === 1) { gA = 0; aWin = true; gB = 0; bWin = false }        // single court: winners vs losers of same game
    else if (i === 0) { gA = 0; aWin = true; gB = 1; bWin = true }    // top: own winners + climbers below
    else if (i === n - 1) { gA = i - 1; aWin = false; gB = i; bWin = false } // bottom: droppers above + own losers
    else { gA = i - 1; aWin = false; gB = i + 1; bWin = true }        // middle: droppers above + climbers below

    if (!isScored(sourceRound[gA]) || !isScored(sourceRound[gB])) {
      out.push({ court: i + 1, ready: false })
      continue
    }

    const pairA = aWin ? winnerOf(sourceRound[gA]) : loserOf(sourceRound[gA])
    const pairB = bWin ? winnerOf(sourceRound[gB]) : loserOf(sourceRound[gB])
    const [x, y] = pairA
    const [z, w] = pairB
    const options: { t1: [string, string]; t2: [string, string] }[] = [
      { t1: [x, z], t2: [y, w] },
      { t1: [x, w], t2: [y, z] },
    ]
    const cost = (o: { t1: [string, string]; t2: [string, string] }) => {
      const tPartner = P(o.t1[0], o.t1[1]) + P(o.t2[0], o.t2[1])
      const tOpp = O(o.t1[0], o.t2[0]) + O(o.t1[0], o.t2[1]) + O(o.t1[1], o.t2[0]) + O(o.t1[1], o.t2[1])
      const sPartner = SP(o.t1[0], o.t1[1]) + SP(o.t2[0], o.t2[1])
      const sOpp = SO(o.t1[0], o.t2[0]) + SO(o.t1[0], o.t2[1]) + SO(o.t1[1], o.t2[0]) + SO(o.t1[1], o.t2[1])
      // Tonight's no-repeat rule dominates; season freshness only breaks ties.
      return tPartner * 1_000_000 + tOpp * 10_000 + sPartner * 100 + sOpp
    }
    const chosen = cost(options[0]) <= cost(options[1]) ? options[0] : options[1]
    out.push({ court: i + 1, ready: true, pair1: chosen.t1, pair2: chosen.t2 })
  }
  return out
}
