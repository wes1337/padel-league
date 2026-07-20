import type { Match } from '../types'

type Pair = [string, string]

function partnerRec(a: string, b: string, games: Match[]): { g: number; w: number } {
  let g = 0, w = 0
  for (const m of games) {
    const onT1 = (m.team1_p1 === a && m.team1_p2 === b) || (m.team1_p1 === b && m.team1_p2 === a)
    const onT2 = (m.team2_p1 === a && m.team2_p2 === b) || (m.team2_p1 === b && m.team2_p2 === a)
    if (!onT1 && !onT2) continue
    g++
    const t1Won = m.team1_score > m.team2_score
    if ((onT1 && t1Won) || (onT2 && !t1Won)) w++
  }
  return { g, w }
}

function h2h(a: string, b: string, games: Match[]): { meet: number; aw: number } {
  let meet = 0, aw = 0
  for (const m of games) {
    const aT1 = m.team1_p1 === a || m.team1_p2 === a
    const aT2 = m.team2_p1 === a || m.team2_p2 === a
    const bT1 = m.team1_p1 === b || m.team1_p2 === b
    const bT2 = m.team2_p1 === b || m.team2_p2 === b
    if ((aT1 && bT2) || (aT2 && bT1)) {
      meet++
      if ((aT1 && m.team1_score > m.team2_score) || (aT2 && m.team2_score > m.team1_score)) aw++
    }
  }
  return { meet, aw }
}

export interface RotationItem { icon: string; head: string; sub: string }

/**
 * Rotation-focused read for a court: why these partners were chosen (how fresh
 * each new pairing is), and a flag for any duo that's crossing paths too often —
 * with the full partners-AND-opponents record so the balance is visible. Each
 * item is a bold heading + a muted detail line so long stats stay readable.
 * Uses this season's games only.
 */
export function courtSeasonStats(pair1: Pair, pair2: Pair, season: Match[], tonight: Match[], nameOf: (id: string) => string): RotationItem[] {
  const nm = (p: Pair) => `${nameOf(p[0])} & ${nameOf(p[1])}`
  const items: RotationItem[] = []

  // Whether these two have already crossed paths in THIS session (most relevant
  // to the current rotation). `asPartners` picks the right framing for the tag.
  const tonightNote = (a: string, b: string, asPartners: boolean): string => {
    const tp = partnerRec(a, b, tonight).g
    const to = h2h(a, b, tonight).meet
    if (asPartners) {
      if (tp > 0) return ' · ⚠️ already partnered earlier tonight'
      if (to > 0) return ` · were rivals earlier tonight${to > 1 ? ` (${to}×)` : ''}`
    } else {
      if (to > 0) return ` · ⚠️ already faced off tonight${to > 1 ? ` (${to}×)` : ''}`
      if (tp > 0) return ' · partnered earlier tonight'
    }
    return ''
  }

  // Why these partners — freshness + how they do together (+ tonight context).
  for (const p of [pair1, pair2]) {
    const pr = partnerRec(p[0], p[1], season)
    const rec = pr.g ? ` · ${pr.w}W–${pr.g - pr.w}L` : ''
    const base = pr.g === 0 ? 'Fresh pairing — first time together this season'
      : pr.g === 1 ? `2nd time together${rec}`
      : `Together ${pr.g + 1}× counting tonight${rec}`
    items.push({ icon: '🤝', head: nm(p), sub: base + tonightNote(p[0], p[1], true) })
  }

  // Rotation flags — pairs among the four who overlap a lot, with BOTH records.
  const four = [pair1[0], pair1[1], pair2[0], pair2[1]]
  const sameTeam = (a: string, b: string) =>
    (pair1.includes(a) && pair1.includes(b)) || (pair2.includes(a) && pair2.includes(b))
  const flags: { item: RotationItem; total: number }[] = []
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const a = four[i], b = four[j]
    const pr = partnerRec(a, b, season)
    const hh = h2h(a, b, season)
    if (pr.g + hh.meet < 4) continue // only flag genuinely over-shared pairs
    const together = sameTeam(a, b)
    const partners = pr.g ? `${pr.g}× partners (${pr.w}W–${pr.g - pr.w}L)` : 'never partnered'
    const leader = hh.aw >= hh.meet - hh.aw ? a : b
    const opp = hh.meet ? `${hh.meet}× opponents (${nameOf(leader)} ${Math.max(hh.aw, hh.meet - hh.aw)}–${Math.min(hh.aw, hh.meet - hh.aw)})` : 'never opponents'
    const status = together ? 'partners again here' : 'opponents again here'
    flags.push({ item: { icon: '♻️', head: `${nameOf(a)} & ${nameOf(b)} — ${status}`, sub: `${partners} · ${opp}${tonightNote(a, b, together)}` }, total: pr.g + hh.meet })
  }
  flags.sort((x, y) => y.total - x.total)
  for (const f of flags.slice(0, 2)) items.push(f.item)

  return items
}
