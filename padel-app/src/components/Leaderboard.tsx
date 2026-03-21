import { Link } from 'react-router-dom'
import type { PlayerStats } from '../types'

interface Props {
  stats: PlayerStats[]
  leagueId: string
  sessionId?: string
  crownPlayerId?: string
  spoonPlayerId?: string
  movements?: Record<string, number>
}

const medals = ['🥇', '🥈', '🥉']

export default function Leaderboard({ stats, leagueId, sessionId, crownPlayerId, spoonPlayerId, movements }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {stats.map((s, i) => {
        const diff = s.pointDiff
        const winPct = Math.round(s.winRate * 100)
        const isCrown = crownPlayerId && s.player.id === crownPlayerId
        const isSpoon = spoonPlayerId && s.player.id === spoonPlayerId
        const isFlame = s.currentStreak >= 3
        const isPoop = s.currentStreak <= -3
        const movement = movements?.[s.player.id]
        const isNew = movement === Infinity
        return (
          <Link
            key={s.player.id}
            to={sessionId ? `/l/${leagueId}/session/${sessionId}/player/${s.player.id}` : `/l/${leagueId}/player/${s.player.id}`}
            className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 transition-colors"
          >
            {/* Rank + movement */}
            <div className="flex flex-col items-center shrink-0 w-7">
              <span className="text-lg text-center">
                {i < 3 ? medals[i] : <span className="text-gray-400 text-sm font-semibold">{i + 1}</span>}
              </span>
              {movements && (
                <span className={`text-xs font-bold leading-none ${isNew ? 'text-blue-400' : !movement || movement === 0 ? 'text-gray-600' : movement > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {isNew ? 'NEW' : !movement || movement === 0 ? '–' : movement > 0 ? `↑${movement}` : `↓${Math.abs(movement)}`}
                </span>
              )}
            </div>

            {/* Name + badge */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-semibold truncate">{s.player.name}</span>
                {isCrown && <span className="shrink-0">👑</span>}
                {isSpoon && <span className="shrink-0">🥄</span>}
                {isFlame && <span className="shrink-0">🔥</span>}
                {isPoop && <span className="shrink-0">💩</span>}
                {s.lowAttendance && (
                  <span className="text-yellow-500 text-sm shrink-0" title={`Low attendance (${Math.round(s.attendancePct * 100)}%)`}>⚠</span>
                )}
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                {s.wins}W – {s.losses}L · {winPct}% win rate
              </div>
            </div>

            {/* Point diff */}
            <div className="shrink-0">
              <div className={`text-sm font-semibold ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {diff > 0 ? `+${diff}` : diff}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
