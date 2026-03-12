import type { Match, Player, PlayerStats } from '../types'
import PlayerOfNightCard from './PlayerOfNightCard'

interface Props {
  matches: Match[]
  players: Player[]
  stats: PlayerStats[]
  sessionLabel: string
}

function Award({ emoji, title, names, stat }: { emoji: string; title: string; names: string[]; stat: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 flex flex-col gap-1">
      <p className="text-gray-400 text-xs">{emoji} {title}</p>
      {names.map((n, i) => (
        <p key={i} className="text-white font-bold text-sm truncate">{n}</p>
      ))}
      <p className="text-gray-500 text-xs">{stat}</p>
    </div>
  )
}

export default function SessionSummary({ matches, players, stats, sessionLabel }: Props) {
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

  // Wooden Spoon — fewest wins, then worst point diff
  const byWins = [...playerList].sort((a, b) => a.wins - b.wins || (a.scored - a.conceded) - (b.scored - b.conceded))
  const spoonVal = byWins[0]
  const spoons = playerList.filter(p =>
    p.wins === spoonVal.wins && (p.scored - p.conceded) === (spoonVal.scored - spoonVal.conceded)
  )

  // Top Scorer
  const maxScored = Math.max(...playerList.map(p => p.scored))
  const topScorers = playerList.filter(p => p.scored === maxScored)

  // Best Defense
  const minConceded = Math.min(...playerList.map(p => p.conceded))
  const bestDefenders = playerList.filter(p => p.conceded === minConceded)

  // ── Match highlights ────────────────────────────────────────────────────────
  const gaps = matches.map(m => Math.abs(m.team1_score - m.team2_score))
  const minGap = Math.min(...gaps)
  const maxGap = Math.max(...gaps)

  const matchesOfNight = matches.filter(m => Math.abs(m.team1_score - m.team2_score) === minGap)
  const blowouts = maxGap !== minGap ? matches.filter(m => Math.abs(m.team1_score - m.team2_score) === maxGap) : []

  function matchLabel(m: Match) {
    const t1Won = m.team1_score > m.team2_score
    const [winners, losers, ws, ls] = t1Won
      ? [`${getName(m.team1_p1)} & ${getName(m.team1_p2)}`, `${getName(m.team2_p1)} & ${getName(m.team2_p2)}`, m.team1_score, m.team2_score]
      : [`${getName(m.team2_p1)} & ${getName(m.team2_p2)}`, `${getName(m.team1_p1)} & ${getName(m.team1_p2)}`, m.team2_score, m.team1_score]
    return { winners: winners as string, stat: `${ws}–${ls} vs ${losers}` }
  }

  const topPlayer = stats[0] ?? null

  return (
    <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-4">
      <h2 className="font-semibold text-white text-lg">🏆 Session Awards</h2>

      {/* King of the Court card */}
      {topPlayer && (
        <div className="flex justify-center">
          <PlayerOfNightCard player={topPlayer} sessionLabel={sessionLabel} />
        </div>
      )}

      {/* Player Awards */}
      <div>
        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Player Awards</p>
        <div className="grid grid-cols-2 gap-2">
          {spoons.length > 0 && (
            <Award emoji="💀" title="Wooden Spoon" names={spoons.map(p => p.name)} stat={`${spoonVal.wins}W ${spoonVal.losses}L`} />
          )}
          {topScorers.length > 0 && (
            <Award emoji="⚡" title="Top Scorer" names={topScorers.map(p => p.name)} stat={`${maxScored} pts scored`} />
          )}
          {bestDefenders.length > 0 && (
            <Award emoji="🛡️" title="Best Defense" names={bestDefenders.map(p => p.name)} stat={`${minConceded} pts conceded`} />
          )}
        </div>
      </div>

      {/* Match Awards */}
      {(matchesOfNight.length > 0 || blowouts.length > 0) && (
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Match Awards</p>
          <div className="grid grid-cols-2 gap-2">
            {matchesOfNight.map((m, i) => {
              const { winners, stat } = matchLabel(m)
              return <Award key={i} emoji="🎯" title="Match of the Night" names={[winners]} stat={stat} />
            })}
            {blowouts.map((m, i) => {
              const { winners, stat } = matchLabel(m)
              return <Award key={i} emoji="💥" title="Biggest Blowout" names={[winners]} stat={stat} />
            })}
          </div>
        </div>
      )}
    </div>
  )
}
