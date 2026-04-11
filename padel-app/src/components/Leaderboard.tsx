import { Link } from 'react-router-dom'
import type { PlayerStats } from '../types'

interface Props {
  stats: PlayerStats[]
  leagueId: string
  sessionId?: string
  crownPlayerId?: string
  poopPlayerId?: string
  movements?: Record<string, number>
  seasonChampionIds?: Set<string>
}

const medals = ['🥇', '🥈', '🥉']

export default function Leaderboard({ stats, leagueId, sessionId, crownPlayerId, poopPlayerId, movements, seasonChampionIds }: Props) {
  // Compute true ranks accounting for ties (same winRate + pointDiff = same rank)
  const ranks: number[] = []
  stats.forEach((s, i) => {
    if (i === 0) { ranks.push(1); return }
    const prev = stats[i - 1]
    if (s.winRate === prev.winRate && s.pointDiff === prev.pointDiff) {
      ranks.push(ranks[i - 1])
    } else {
      ranks.push(i + 1)
    }
  })

  return (
    <div className="flex flex-col gap-2">
      {stats.map((s, i) => {
        const rank = ranks[i]
        const diff = s.pointDiff
        const winPct = (s.winRate * 100).toFixed(1)
        const isCrown = crownPlayerId && s.player.id === crownPlayerId
        const isPoop = poopPlayerId && s.player.id === poopPlayerId
        const isChampion = seasonChampionIds?.has(s.player.id)
        const movement = movements?.[s.player.id]
        const isNew = movement === Infinity
        return (
          <Link
            key={s.player.id}
            to={sessionId ? `/l/${leagueId}/session/${sessionId}/player/${s.player.id}` : `/l/${leagueId}/player/${s.player.id}`}
            className="flex items-center gap-3 bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 transition-colors"
          >
            {/* Rank + movement */}
            <div className="flex flex-col items-center shrink-0 w-7">
              <span className="text-lg text-center">
                {rank <= 3 ? medals[rank - 1] : <span className="text-gray-500 text-sm font-semibold">{rank}</span>}
              </span>
              {movements && (
                <span className={`text-xs font-bold leading-none ${isNew ? 'text-blue-600' : !movement || movement === 0 ? 'text-gray-400' : movement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {isNew ? 'NEW' : !movement || movement === 0 ? '–' : movement > 0 ? `↑${movement}` : `↓${Math.abs(movement)}`}
                </span>
              )}
            </div>

            {/* Name + point diff + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-900 font-semibold truncate">{s.player.name}</span>
                <span className={`font-semibold shrink-0 ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {diff > 0 ? `+${diff}` : diff}
                </span>
                <span className="text-[9px] uppercase tracking-wide text-gray-400 shrink-0">Pts diff</span>
                {isChampion && <span className="shrink-0" title="Season Champion">🏆</span>}
                {isCrown && <span className="shrink-0">👑</span>}
                {isPoop && <span className="shrink-0">💩</span>}
                {s.lowAttendance && (
                  <span className="text-yellow-600 text-sm shrink-0" title={`Low attendance (${Math.round(s.attendancePct * 100)}%)`}>⚠</span>
                )}
              </div>
              <div className="text-gray-500 text-xs mt-0.5">
                {s.wins}W – {s.losses}L
              </div>
            </div>

            {/* Win rate + view stats */}
            <div className="shrink-0 flex items-center gap-2">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-sm font-semibold text-gray-900">{winPct}%</span>
                <span className="text-[9px] uppercase tracking-wide text-gray-400 mt-0.5">Win rate</span>
              </div>
              <div className="flex items-center gap-0.5 text-gray-400">
                <span className="text-xs">Stats</span>
                <span className={`text-sm ${sessionId ? 'text-blue-400' : 'text-green-500'}`}>→</span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
