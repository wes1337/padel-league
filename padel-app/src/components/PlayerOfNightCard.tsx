import type { PlayerStats } from '../types'

interface Props {
  player: PlayerStats
  sessionLabel: string
}

export default function PlayerOfNightCard({ player, sessionLabel }: Props) {
  const diff = player.pointDiff
  const winRate = Math.round(player.winRate * 100)

  return (
    <div
      style={{ fontFamily: 'system-ui, sans-serif', width: 340, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
      className="rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl"
    >
      <div className="text-5xl">🏆</div>

      <div className="text-center">
        <p className="text-yellow-400 text-sm font-semibold uppercase tracking-widest">Court Champion</p>
        <p className="text-gray-300 text-xs mt-0.5">{sessionLabel}</p>
      </div>

      <div className="text-white text-3xl font-extrabold tracking-tight text-center">
        {player.player.name.toUpperCase()}
      </div>

      <div className="w-full bg-white/10 rounded-2xl p-4 grid grid-cols-2 gap-x-3 gap-y-3 text-center">
        <div>
          <div className="text-white text-2xl font-bold">{player.matchesPlayed}</div>
          <div className="text-gray-300 text-xs mt-0.5">Matches</div>
        </div>
        <div>
          <div className="text-white text-2xl font-bold">{winRate}%</div>
          <div className="text-gray-300 text-xs mt-0.5">Win Rate</div>
        </div>
        <div>
          <div className="text-white text-2xl font-bold">
            <span className="text-green-400">{player.wins}</span>
            <span className="text-gray-400 text-lg mx-1">–</span>
            <span className="text-red-400">{player.losses}</span>
          </div>
          <div className="text-gray-300 text-xs mt-0.5">W – L</div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-white'}`}>
            {diff > 0 ? `+${diff}` : diff}
          </div>
          <div className="text-gray-300 text-xs mt-0.5">Pt Diff</div>
        </div>
      </div>

      <p className="text-gray-400 text-xs">🎾 Padel League</p>
    </div>
  )
}
