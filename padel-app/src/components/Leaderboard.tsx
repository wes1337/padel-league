import { Link } from 'react-router-dom'
import type { PlayerStats } from '../types'

interface Props {
  stats: PlayerStats[]
  leagueId: string
  showAttendance?: boolean
  totalMatches?: number
}

const medals = ['🥇', '🥈', '🥉']

export default function Leaderboard({ stats, leagueId, showAttendance = false, totalMatches = 0 }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {stats.map((s, i) => {
        const diff = s.pointDiff
        return (
          <Link
            key={s.player.id}
            to={`/l/${leagueId}/player/${s.player.id}`}
            className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 transition-colors"
          >
            {/* Rank */}
            <span className="text-lg w-7 text-center shrink-0">
              {i < 3 ? medals[i] : <span className="text-gray-400 text-sm font-semibold">{i + 1}</span>}
            </span>

            {/* Name + badge */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-semibold truncate">{s.player.name}</span>
                {s.lowAttendance && (
                  <span className="text-yellow-500 text-sm shrink-0" title={`Low attendance (${Math.round(s.attendancePct * 100)}%)`}>⚠</span>
                )}
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                {s.wins}W – {s.losses}L · {s.matchesPlayed} played
                {showAttendance && totalMatches > 0 && (
                  <> · {Math.round(s.attendancePct * 100)}% attendance</>
                )}
              </div>
            </div>

            {/* Point diff */}
            <div className={`text-sm font-semibold shrink-0 ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {diff > 0 ? `+${diff}` : diff}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
