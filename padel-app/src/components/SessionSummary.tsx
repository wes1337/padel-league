import { useState } from 'react'
import type { Match, Player, PlayerStats } from '../types'
import PlayerOfNightCard from './PlayerOfNightCard'

interface Props {
  matches: Match[]
  players: Player[]
  stats: PlayerStats[]
  sessionLabel: string
}

type AwardEntry = { name: string; nameStat?: string; stat?: string; statColor?: string }

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
          <div key={i}>
            <p className="text-white font-bold text-sm truncate">{e.name}</p>
            {(e.nameStat || e.stat) && (
              <p className="text-xs flex gap-2">
                {e.nameStat && <span className="text-gray-500">{e.nameStat}</span>}
                {e.stat && <span className={e.statColor ?? 'text-gray-500'}>{e.stat}</span>}
              </p>
            )}
          </div>
        ))}
      </div>
      {second && second.length > 0 && (
        <div className="border-t border-gray-700 pt-1.5 flex flex-col gap-1">
          {second.map((e, i) => (
            <div key={i}>
              <p className="text-gray-300 text-xs font-semibold truncate">{e.name}</p>
              {(e.nameStat || e.stat) && (
                <p className="text-xs flex gap-2">
                  {e.nameStat && <span className="text-gray-600">{e.nameStat}</span>}
                  {e.stat && <span className={e.statColor ?? 'text-gray-600'}>{e.stat}</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function drawChampionCard(player: PlayerStats, label: string): Promise<File | null> {
  return new Promise(resolve => {
    const W = 680, H = 520, R = 40
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { resolve(null); return }

    // Rounded rect background with gradient
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#1a1a2e')
    grad.addColorStop(0.5, '#16213e')
    grad.addColorStop(1, '#0f3460')
    ctx.beginPath()
    ctx.moveTo(R, 0); ctx.lineTo(W - R, 0); ctx.quadraticCurveTo(W, 0, W, R)
    ctx.lineTo(W, H - R); ctx.quadraticCurveTo(W, H, W - R, H)
    ctx.lineTo(R, H); ctx.quadraticCurveTo(0, H, 0, H - R)
    ctx.lineTo(0, R); ctx.quadraticCurveTo(0, 0, R, 0)
    ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()

    // Trophy emoji
    ctx.font = '60px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🏆', W / 2, 70)

    // "COURT CHAMPION"
    ctx.font = '600 14px system-ui, sans-serif'
    ctx.fillStyle = '#facc15'
    ctx.letterSpacing = '4px'
    ctx.fillText('COURT CHAMPION', W / 2, 110)
    ctx.letterSpacing = '0px'

    // Session label
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillStyle = '#9ca3af'
    ctx.fillText(label, W / 2, 132)

    // Player name
    ctx.font = '800 36px system-ui, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(player.player.name.toUpperCase(), W / 2, 185)

    // Stats box
    const boxX = 60, boxY = 215, boxW = W - 120, boxH = 110, boxR = 24
    ctx.beginPath()
    ctx.moveTo(boxX + boxR, boxY)
    ctx.lineTo(boxX + boxW - boxR, boxY); ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + boxR)
    ctx.lineTo(boxX + boxW, boxY + boxH - boxR); ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - boxR, boxY + boxH)
    ctx.lineTo(boxX + boxR, boxY + boxH); ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - boxR)
    ctx.lineTo(boxX, boxY + boxR); ctx.quadraticCurveTo(boxX, boxY, boxX + boxR, boxY)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill()

    // Stats values
    const cols = [boxX + boxW / 6, boxX + boxW / 2, boxX + (5 * boxW) / 6]
    const diff = player.pointDiff
    const winRate = Math.round(player.winRate * 100)

    ctx.font = '700 32px system-ui, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(player.wins), cols[0], boxY + 50)
    ctx.fillText(`${winRate}%`, cols[1], boxY + 50)
    ctx.fillStyle = diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#ffffff'
    ctx.fillText(diff > 0 ? `+${diff}` : String(diff), cols[2], boxY + 50)

    // Stats labels
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillStyle = '#9ca3af'
    ctx.fillText('Wins', cols[0], boxY + 78)
    ctx.fillText('Win Rate', cols[1], boxY + 78)
    ctx.fillText('Pt Diff', cols[2], boxY + 78)

    // Footer
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText('🎾 Padel League', W / 2, H - 30)

    canvas.toBlob(blob => {
      if (!blob) { resolve(null); return }
      resolve(new File([blob], 'court-champion.png', { type: 'image/png' }))
    }, 'image/png')
  })
}

export default function SessionSummary({ matches, players, stats, sessionLabel }: Props) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    setSharing(true)
    try {
      const top = stats[0]
      const url = window.location.href
      const text = top
        ? `${sessionLabel} — ${top.player.name} crowned Court Champion! Check out the full results: ${url}`
        : `${sessionLabel} — Check out the session results! ${url}`

      // Generate card image
      const file = top ? await drawChampionCard(top, sessionLabel) : null

      if (typeof navigator.share === 'function') {
        if (file) {
          const withFile: ShareData = { text, files: [file] }
          if (navigator.canShare?.(withFile)) {
            await navigator.share(withFile)
            setSharing(false)
            return
          }
        }
        await navigator.share({ title: sessionLabel, text, url })
      } else {
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share failed:', err)
      }
    }
    setSharing(false)
  }

  async function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

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
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white text-lg">🏆 Session Awards</h2>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {sharing ? '...' : 'Share'}
          </button>
          <button
            onClick={handleCopyLink}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

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
              first={spoons1.map(p => ({ name: p.name, nameStat: `${p.wins}W ${p.losses}L`, stat: String(p.scored - p.conceded), statColor: 'text-red-400' }))}
              second={spoons2.map(p => ({ name: p.name, nameStat: `${p.wins}W ${p.losses}L`, stat: String(p.scored - p.conceded), statColor: 'text-red-400' }))}
            />
          )}
          {topScorers1.length > 0 && (
            <Award emoji="⚡" title="Top Scorer"
              first={topScorers1.map(p => ({ name: p.name, nameStat: `${p.wins}W ${p.losses}L`, stat: String(p.scored), statColor: 'text-green-400' }))}
              second={topScorers2.map(p => ({ name: p.name, nameStat: `${p.wins}W ${p.losses}L`, stat: String(scorer2!.scored), statColor: 'text-green-400' }))}
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
              <Award key={`motn-${i}`} emoji="🎯" title="Match of the Session"
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
