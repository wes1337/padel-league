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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawTrophy(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size / 60
  ctx.save()
  ctx.translate(cx, cy)

  // Cup body
  ctx.beginPath()
  ctx.moveTo(-18 * s, -22 * s)
  ctx.quadraticCurveTo(-20 * s, 8 * s, -10 * s, 14 * s)
  ctx.lineTo(10 * s, 14 * s)
  ctx.quadraticCurveTo(20 * s, 8 * s, 18 * s, -22 * s)
  ctx.closePath()
  const cupGrad = ctx.createLinearGradient(0, -22 * s, 0, 14 * s)
  cupGrad.addColorStop(0, '#fbbf24')
  cupGrad.addColorStop(1, '#d97706')
  ctx.fillStyle = cupGrad; ctx.fill()

  // Cup shine
  ctx.beginPath()
  ctx.moveTo(-10 * s, -18 * s)
  ctx.quadraticCurveTo(-12 * s, 4 * s, -6 * s, 10 * s)
  ctx.lineTo(-2 * s, 10 * s)
  ctx.quadraticCurveTo(-6 * s, 2 * s, -4 * s, -18 * s)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill()

  // Left handle
  ctx.beginPath()
  ctx.moveTo(-18 * s, -16 * s)
  ctx.quadraticCurveTo(-28 * s, -10 * s, -24 * s, 2 * s)
  ctx.quadraticCurveTo(-20 * s, 10 * s, -14 * s, 6 * s)
  ctx.lineWidth = 3.5 * s; ctx.strokeStyle = '#d97706'; ctx.stroke()

  // Right handle
  ctx.beginPath()
  ctx.moveTo(18 * s, -16 * s)
  ctx.quadraticCurveTo(28 * s, -10 * s, 24 * s, 2 * s)
  ctx.quadraticCurveTo(20 * s, 10 * s, 14 * s, 6 * s)
  ctx.stroke()

  // Stem
  ctx.fillStyle = '#b45309'
  ctx.fillRect(-3 * s, 14 * s, 6 * s, 10 * s)

  // Base
  roundRect(ctx, -14 * s, 24 * s, 28 * s, 6 * s, 3 * s)
  ctx.fillStyle = '#d97706'; ctx.fill()

  // Star on cup
  drawStar(ctx, 0, -4 * s, 7 * s, 5, '#fef3c7')

  ctx.restore()
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number, color: string) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2
    const radius = i % 2 === 0 ? r : r * 0.4
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = color; ctx.fill()
}

function drawChampionCard(player: PlayerStats, label: string): Promise<File | null> {
  return new Promise(resolve => {
    const W = 680, H = 580, R = 40, pad = 50
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { resolve(null); return }

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#0c0e1a')
    grad.addColorStop(0.4, '#111936')
    grad.addColorStop(1, '#0a1628')
    roundRect(ctx, 0, 0, W, H, R)
    ctx.fillStyle = grad; ctx.fill()

    // Subtle outer border
    roundRect(ctx, 0, 0, W, H, R)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2; ctx.stroke()

    // Glow behind trophy
    const glow = ctx.createRadialGradient(W / 2, 100, 0, W / 2, 100, 140)
    glow.addColorStop(0, 'rgba(251,191,36,0.12)')
    glow.addColorStop(1, 'rgba(251,191,36,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, 240)

    // Trophy
    drawTrophy(ctx, W / 2, 85, 70)

    // "COURT CHAMPION"
    ctx.textAlign = 'center'
    ctx.font = '700 18px system-ui, sans-serif'
    ctx.fillStyle = '#fbbf24'
    ctx.letterSpacing = '6px'
    ctx.fillText('COURT CHAMPION', W / 2, 160)
    ctx.letterSpacing = '0px'

    // Session label
    ctx.font = '400 14px system-ui, sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText(label, W / 2, 184)

    // Decorative line
    const lineY = 200
    const lineGrad = ctx.createLinearGradient(pad + 60, lineY, W - pad - 60, lineY)
    lineGrad.addColorStop(0, 'rgba(251,191,36,0)')
    lineGrad.addColorStop(0.5, 'rgba(251,191,36,0.3)')
    lineGrad.addColorStop(1, 'rgba(251,191,36,0)')
    ctx.fillStyle = lineGrad
    ctx.fillRect(pad + 60, lineY, W - 2 * pad - 120, 1)

    // Player name with glow
    ctx.save()
    ctx.shadowColor = 'rgba(255,255,255,0.15)'
    ctx.shadowBlur = 20
    ctx.font = '800 44px system-ui, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(player.player.name.toUpperCase(), W / 2, 250)
    ctx.restore()

    // Stats box
    const boxX = pad + 20, boxY = 280, boxW = W - 2 * (pad + 20), boxH = 130, boxR = 20

    // Box with subtle border
    roundRect(ctx, boxX, boxY, boxW, boxH, boxR)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill()
    roundRect(ctx, boxX, boxY, boxW, boxH, boxR)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke()

    // Divider lines in box
    const third = boxW / 3
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(boxX + third, boxY + 20, 1, boxH - 40)
    ctx.fillRect(boxX + third * 2, boxY + 20, 1, boxH - 40)

    // Stats
    const cols = [boxX + third / 2, boxX + third * 1.5, boxX + third * 2.5]
    const diff = player.pointDiff
    const winRate = Math.round(player.winRate * 100)

    ctx.font = '700 38px system-ui, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(player.wins), cols[0], boxY + 60)
    ctx.fillText(`${winRate}%`, cols[1], boxY + 60)
    ctx.fillStyle = diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#ffffff'
    ctx.fillText(diff > 0 ? `+${diff}` : String(diff), cols[2], boxY + 60)

    // Labels
    ctx.font = '500 13px system-ui, sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText('Wins', cols[0], boxY + 90)
    ctx.fillText('Win Rate', cols[1], boxY + 90)
    ctx.fillText('Pt Diff', cols[2], boxY + 90)

    // Footer with subtle line
    const footY = H - 55
    const footGrad = ctx.createLinearGradient(pad + 100, footY, W - pad - 100, footY)
    footGrad.addColorStop(0, 'rgba(255,255,255,0)')
    footGrad.addColorStop(0.5, 'rgba(255,255,255,0.06)')
    footGrad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = footGrad
    ctx.fillRect(pad + 100, footY, W - 2 * pad - 200, 1)

    ctx.font = '500 13px system-ui, sans-serif'
    ctx.fillStyle = '#4b5563'
    ctx.fillText('Padel League', W / 2, H - 28)

    // Small decorative dots
    ctx.fillStyle = 'rgba(251,191,36,0.15)'
    ctx.beginPath(); ctx.arc(W / 2 - 60, H - 28, 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(W / 2 + 60, H - 28, 2, 0, Math.PI * 2); ctx.fill()

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
