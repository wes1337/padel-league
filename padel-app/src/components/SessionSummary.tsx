import type { Match, Player, PlayerStats } from '../types'
import PlayerOfNightCard from './PlayerOfNightCard'

interface Props {
  matches: Match[]
  players: Player[]
  stats: PlayerStats[]
  sessionLabel: string
}

type AwardEntry = { name: string; stat: string }

function Award({ emoji, title, first, second }: {
  emoji: string; title: string
  first: AwardEntry[]
  second?: AwardEntry[]
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 flex flex-col gap-1.5">
      <p className="text-gray-400 text-xs">{emoji} {title}</p>
      <div>
        {first.map((e, i) => (
          <p key={i} className="text-white font-bold text-sm truncate">{e.name}</p>
        ))}
        <p className="text-gray-500 text-xs">{first[0]?.stat}</p>
      </div>
      {second && second.length > 0 && (
        <div className="border-t border-gray-700 pt-1.5 flex flex-col gap-1">
          {second.map((e, i) => (
            <div key={i}>
              <p className="text-gray-300 text-xs font-semibold truncate">{e.name}</p>
              <p className="text-gray-600 text-xs">{e.stat}</p>
            </div>
          ))}
        </div>
      )}
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
  const spoon1 = byWins[0]
  const spoons1 = playerList.filter(p => p.wins === spoon1.wins && (p.scored - p.conceded) === (spoon1.scored - spoon1.conceded))
  const spoon2 = byWins.find(p => !spoons1.includes(p))
  const spoons2 = spoon2 ? playerList.filter(p => !spoons1.includes(p) && p.wins === spoon2.wins && (p.scored - p.conceded) === (spoon2.scored - spoon2.conceded)) : []

  // Top Scorer
  const scoredSorted = [...playerList].sort((a, b) => b.scored - a.scored)
  const maxScored = scoredSorted[0]?.scored ?? 0
  const topScorers1 = playerList.filter(p => p.scored === maxScored)
  const scorer2 = scoredSorted.find(p => !topScorers1.includes(p))
  const topScorers2 = scorer2 ? playerList.filter(p => !topScorers1.includes(p) && p.scored === scorer2.scored) : []

  // Best Defense
  const concededSorted = [...playerList].sort((a, b) => a.conceded - b.conceded)
  const minConceded = concededSorted[0]?.conceded ?? 0
  const bestDefenders1 = playerList.filter(p => p.conceded === minConceded)
  const defender2 = concededSorted.find(p => !bestDefenders1.includes(p))
  const bestDefenders2 = defender2 ? playerList.filter(p => !bestDefenders1.includes(p) && p.conceded === defender2.conceded) : []

  // ── Match highlights ────────────────────────────────────────────────────────
  function matchEntry(m: Match): AwardEntry {
    const t1Won = m.team1_score > m.team2_score
    const [winners, losers, ws, ls] = t1Won
      ? [`${getName(m.team1_p1)} & ${getName(m.team1_p2)}`, `${getName(m.team2_p1)} & ${getName(m.team2_p2)}`, m.team1_score, m.team2_score]
      : [`${getName(m.team2_p1)} & ${getName(m.team2_p2)}`, `${getName(m.team1_p1)} & ${getName(m.team1_p2)}`, m.team2_score, m.team1_score]
    return { name: winners as string, stat: `${ws}–${ls} vs ${losers}` }
  }

  const gaps = matches.map(m => Math.abs(m.team1_score - m.team2_score))
  const sortedGaps = [...new Set(gaps)].sort((a, b) => a - b)
  const minGap = sortedGaps[0]
  const maxGap = sortedGaps[sortedGaps.length - 1]

  const motn1 = matches.filter(m => Math.abs(m.team1_score - m.team2_score) === minGap).map(matchEntry)
  const motnGap2 = sortedGaps[1]
  const motn2 = motnGap2 !== undefined ? matches.filter(m => Math.abs(m.team1_score - m.team2_score) === motnGap2).map(matchEntry) : []

  const blowout1 = maxGap !== minGap ? matches.filter(m => Math.abs(m.team1_score - m.team2_score) === maxGap).map(matchEntry) : []
  const blowoutGap2 = maxGap !== minGap ? [...sortedGaps].reverse()[1] : undefined
  const blowout2 = blowoutGap2 !== undefined && blowoutGap2 !== minGap
    ? matches.filter(m => Math.abs(m.team1_score - m.team2_score) === blowoutGap2).map(matchEntry)
    : []

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
          {spoons1.length > 0 && (
            <Award emoji="💀" title="Wooden Spoon"
              first={spoons1.map(p => ({ name: p.name, stat: `${spoon1.wins}W ${spoon1.losses}L` }))}
              second={spoons2.map(p => ({ name: p.name, stat: `${spoon2!.wins}W ${spoon2!.losses}L` }))}
            />
          )}
          {topScorers1.length > 0 && (
            <Award emoji="⚡" title="Top Scorer"
              first={topScorers1.map(p => ({ name: p.name, stat: `${maxScored} pts scored` }))}
              second={topScorers2.map(p => ({ name: p.name, stat: `${scorer2!.scored} pts scored` }))}
            />
          )}
          {bestDefenders1.length > 0 && (
            <Award emoji="🛡️" title="Best Defense"
              first={bestDefenders1.map(p => ({ name: p.name, stat: `${minConceded} pts conceded` }))}
              second={bestDefenders2.map(p => ({ name: p.name, stat: `${defender2!.conceded} pts conceded` }))}
            />
          )}
        </div>
      </div>

      {/* Match Awards */}
      {(motn1.length > 0 || blowout1.length > 0) && (
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Match Awards</p>
          <div className="grid grid-cols-2 gap-2">
            {motn1.map((entry, i) => (
              <Award key={`motn-${i}`} emoji="🎯" title="Match of the Night"
                first={[entry]}
                second={motn1.length === 1 ? motn2 : undefined}
              />
            ))}
            {blowout1.map((entry, i) => (
              <Award key={`blowout-${i}`} emoji="💥" title="Biggest Blowout"
                first={[entry]}
                second={blowout1.length === 1 ? blowout2 : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
