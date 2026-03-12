import type { Match, Player } from '../types'

interface Props {
  matches: Match[]
  players: Player[]
}

function Award({ emoji, title, name, stat }: { emoji: string; title: string; name: string; stat: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 flex flex-col gap-1">
      <p className="text-gray-400 text-xs">{emoji} {title}</p>
      <p className="text-white font-bold text-sm truncate">{name}</p>
      <p className="text-gray-500 text-xs">{stat}</p>
    </div>
  )
}

export default function SessionSummary({ matches, players }: Props) {
  if (matches.length === 0) return null

  const pMap = new Map(players.map(p => [p.id, p.name]))
  const getName = (id: string) => pMap.get(id) ?? '?'

  // ── Individual stats ────────────────────────────────────────────────────────
  const statMap = new Map<string, { wins: number; losses: number; scored: number; conceded: number }>()
  for (const m of matches) {
    const team1Won = m.team1_score > m.team2_score
    for (const pid of [m.team1_p1, m.team1_p2]) {
      if (!statMap.has(pid)) statMap.set(pid, { wins: 0, losses: 0, scored: 0, conceded: 0 })
      const s = statMap.get(pid)!
      s.scored += m.team1_score; s.conceded += m.team2_score
      if (team1Won) s.wins++; else s.losses++
    }
    for (const pid of [m.team2_p1, m.team2_p2]) {
      if (!statMap.has(pid)) statMap.set(pid, { wins: 0, losses: 0, scored: 0, conceded: 0 })
      const s = statMap.get(pid)!
      s.scored += m.team2_score; s.conceded += m.team1_score
      if (!team1Won) s.wins++; else s.losses++
    }
  }

  const playerList = [...statMap.entries()].map(([id, s]) => ({ id, name: getName(id), ...s }))
  const byWins = [...playerList].sort((a, b) => b.wins - a.wins || (b.scored - b.conceded) - (a.scored - a.conceded))
  const king = byWins[0]
  const spoon = byWins[byWins.length - 1] !== king ? byWins[byWins.length - 1] : null
  const topScorer = [...playerList].sort((a, b) => b.scored - a.scored)[0]
  const bestDefense = [...playerList].sort((a, b) => a.conceded - b.conceded)[0]

  // ── Partnership stats ───────────────────────────────────────────────────────
  const partnerMap = new Map<string, { names: string; wins: number; losses: number }>()
  for (const m of matches) {
    const team1Won = m.team1_score > m.team2_score
    for (const [p1, p2, won] of [
      [m.team1_p1, m.team1_p2, team1Won],
      [m.team2_p1, m.team2_p2, !team1Won],
    ] as [string, string, boolean][]) {
      const key = [p1, p2].sort().join('|')
      if (!partnerMap.has(key)) partnerMap.set(key, { names: `${getName(p1)} & ${getName(p2)}`, wins: 0, losses: 0 })
      const ps = partnerMap.get(key)!
      if (won) ps.wins++; else ps.losses++
    }
  }
  const partnerships = [...partnerMap.values()]
  const byWinRate = [...partnerships].sort((a, b) =>
    (b.wins / (b.wins + b.losses)) - (a.wins / (a.wins + a.losses))
  )
  const dreamTeam = byWinRate[0]
  const nightmareDuo = byWinRate[byWinRate.length - 1] !== dreamTeam ? byWinRate[byWinRate.length - 1] : null

  // ── Match highlights ────────────────────────────────────────────────────────
  const byGap = [...matches].sort((a, b) =>
    Math.abs(a.team1_score - a.team2_score) - Math.abs(b.team1_score - b.team2_score)
  )
  const matchOfNight = byGap[0]
  const biggestBlowout = byGap[byGap.length - 1] !== matchOfNight ? byGap[byGap.length - 1] : null

  function matchLabel(m: Match) {
    const t1Won = m.team1_score > m.team2_score
    const [winners, losers, ws, ls] = t1Won
      ? [`${getName(m.team1_p1)} & ${getName(m.team1_p2)}`, `${getName(m.team2_p1)} & ${getName(m.team2_p2)}`, m.team1_score, m.team2_score]
      : [`${getName(m.team2_p1)} & ${getName(m.team2_p2)}`, `${getName(m.team1_p1)} & ${getName(m.team1_p2)}`, m.team2_score, m.team1_score]
    return { winners: winners as string, stat: `${ws}–${ls} vs ${losers}` }
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-4">
      <h2 className="font-semibold text-white text-lg">🏆 Session Awards</h2>

      {/* Player Awards */}
      <div>
        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Player Awards</p>
        <div className="grid grid-cols-2 gap-2">
          {king && <Award emoji="👑" title="King of the Court" name={king.name} stat={`${king.wins}W ${king.losses}L`} />}
          {spoon && <Award emoji="💀" title="Wooden Spoon" name={spoon.name} stat={`${spoon.wins}W ${spoon.losses}L`} />}
          {topScorer && <Award emoji="⚡" title="Top Scorer" name={topScorer.name} stat={`${topScorer.scored} pts scored`} />}
          {bestDefense && <Award emoji="🛡️" title="Best Defense" name={bestDefense.name} stat={`${bestDefense.conceded} pts conceded`} />}
        </div>
      </div>

      {/* Team & Match Awards */}
      <div>
        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Team & Match Awards</p>
        <div className="grid grid-cols-2 gap-2">
          {dreamTeam && <Award emoji="🤝" title="Dream Team" name={dreamTeam.names} stat={`${dreamTeam.wins}W ${dreamTeam.losses}L`} />}
          {nightmareDuo && <Award emoji="☠️" title="Nightmare Duo" name={nightmareDuo.names} stat={`${nightmareDuo.wins}W ${nightmareDuo.losses}L`} />}
          {matchOfNight && (() => { const { winners, stat } = matchLabel(matchOfNight); return <Award emoji="🏆" title="Match of the Night" name={winners} stat={stat} /> })()}
          {biggestBlowout && (() => { const { winners, stat } = matchLabel(biggestBlowout); return <Award emoji="💥" title="Biggest Blowout" name={winners} stat={stat} /> })()}
        </div>
      </div>
    </div>
  )
}
