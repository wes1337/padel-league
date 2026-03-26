import { useEffect, useRef, useState } from 'react'

type CardStyle = {
  name: string
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void
}

const styles: CardStyle[] = [
  {
    name: '1. Current — Esports VS',
    draw: (ctx, W, H) => {
      ctx.fillStyle = '#0a0e1a'
      ctx.fillRect(0, 0, W, H)

      // Diagonal stripes
      ctx.save(); ctx.globalAlpha = 0.04
      for (let i = -H; i < W + H; i += 40) {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.moveTo(i, 0); ctx.lineTo(i + 20, 0)
        ctx.lineTo(i + 20 + H, H); ctx.lineTo(i + H, H)
        ctx.closePath(); ctx.fill()
      }
      ctx.restore()

      const leftGlow = ctx.createRadialGradient(120, H / 2, 0, 120, H / 2, 200)
      leftGlow.addColorStop(0, 'rgba(59,130,246,0.15)'); leftGlow.addColorStop(1, 'rgba(59,130,246,0)')
      ctx.fillStyle = leftGlow; ctx.fillRect(0, 0, W / 2, H)

      const rightGlow = ctx.createRadialGradient(W - 120, H / 2, 0, W - 120, H / 2, 200)
      rightGlow.addColorStop(0, 'rgba(168,85,247,0.15)'); rightGlow.addColorStop(1, 'rgba(168,85,247,0)')
      ctx.fillStyle = rightGlow; ctx.fillRect(W / 2, 0, W / 2, H)

      ctx.font = '80px serif'; ctx.textAlign = 'center'
      ctx.fillText('🏓', 130, H / 2 + 25)
      ctx.save(); ctx.translate(W - 130, H / 2 + 25); ctx.scale(-1, 1); ctx.fillText('🏓', 0, 0); ctx.restore()

      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8])
      ctx.beginPath(); ctx.moveTo(W / 2, 40); ctx.lineTo(W / 2, H - 40); ctx.stroke(); ctx.setLineDash([])

      ctx.save(); ctx.shadowColor = 'rgba(250,204,21,0.4)'; ctx.shadowBlur = 30
      ctx.font = '900 72px system-ui, sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.fillText('VS', W / 2, H / 2 + 10)
      ctx.restore()

      ctx.font = '28px serif'; ctx.fillText('🔥', W / 2 - 60, H / 2 - 30); ctx.fillText('🔥', W / 2 + 60, H / 2 - 30)
      ctx.font = '600 20px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('Padello – 26 Mar 2026', W / 2, 55)
      ctx.font = '800 28px system-ui, sans-serif'; ctx.fillStyle = '#4ade80'; ctx.fillText('GAME ON!', W / 2, H - 80)
      ctx.font = '500 14px system-ui, sans-serif'; ctx.fillStyle = '#9ca3af'; ctx.fillText('Tap to join and track scores', W / 2, H - 52)
      ctx.font = '500 13px system-ui, sans-serif'; ctx.fillStyle = '#6b7280'; ctx.fillText('🎾 Padello', W / 2, H - 20)
    }
  },
  {
    name: '2. Split Lightning',
    draw: (ctx, W, H) => {
      // Left half
      ctx.fillStyle = '#1e3a5f'
      ctx.fillRect(0, 0, W / 2, H)
      // Right half
      ctx.fillStyle = '#4a1942'
      ctx.fillRect(W / 2, 0, W / 2, H)

      // Lightning bolt down center
      ctx.beginPath()
      ctx.moveTo(W / 2 + 15, 0); ctx.lineTo(W / 2 - 20, H * 0.4)
      ctx.lineTo(W / 2 + 10, H * 0.4); ctx.lineTo(W / 2 - 25, H)
      ctx.lineTo(W / 2 - 15, H); ctx.lineTo(W / 2 + 20, H * 0.45)
      ctx.lineTo(W / 2 - 10, H * 0.45); ctx.lineTo(W / 2 + 25, 0)
      ctx.closePath()
      ctx.fillStyle = '#fbbf24'; ctx.fill()

      // Glow behind bolt
      ctx.save(); ctx.globalAlpha = 0.3; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 40; ctx.fill(); ctx.restore()

      ctx.textAlign = 'center'
      ctx.font = '900 80px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10
      ctx.fillText('VS', W / 2, H / 2 + 28); ctx.restore()

      ctx.font = '50px serif'; ctx.fillText('🏓', W * 0.22, H / 2 + 18)
      ctx.save(); ctx.translate(W * 0.78, H / 2 + 18); ctx.scale(-1, 1); ctx.fillText('🏓', 0, 0); ctx.restore()

      ctx.font = '600 22px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('Padello – 26 Mar 2026', W / 2, 50)
      ctx.font = '800 30px system-ui, sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.fillText('BRING YOUR A-GAME', W / 2, H - 70)
      ctx.font = '500 14px system-ui, sans-serif'; ctx.fillStyle = '#d1d5db'; ctx.fillText('Tap to join and track scores', W / 2, H - 42)
      ctx.font = '500 13px system-ui, sans-serif'; ctx.fillStyle = '#9ca3af'; ctx.fillText('🎾 Padello', W / 2, H - 14)
    }
  },
  {
    name: '3. Arena Spotlight',
    draw: (ctx, W, H) => {
      ctx.fillStyle = '#0f0f0f'
      ctx.fillRect(0, 0, W, H)

      // Spotlight cone from top
      const spot = ctx.createRadialGradient(W / 2, -50, 0, W / 2, H / 2, 350)
      spot.addColorStop(0, 'rgba(255,255,255,0.08)'); spot.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H)

      // Floor reflection
      const floor = ctx.createLinearGradient(0, H * 0.7, 0, H)
      floor.addColorStop(0, 'rgba(255,255,255,0)'); floor.addColorStop(1, 'rgba(255,255,255,0.03)')
      ctx.fillStyle = floor; ctx.fillRect(0, H * 0.7, W, H * 0.3)

      // Horizontal lines like a court
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1
      for (let y = H * 0.65; y < H; y += 20) {
        ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 50, y); ctx.stroke()
      }

      // Big emoji battle
      ctx.textAlign = 'center'
      ctx.font = '100px serif'
      ctx.fillText('⚔️', W / 2, H * 0.45)

      // Title
      ctx.font = '900 52px system-ui, sans-serif'
      ctx.save(); ctx.shadowColor = 'rgba(239,68,68,0.5)'; ctx.shadowBlur = 20
      ctx.fillStyle = '#ef4444'; ctx.fillText('WHO DARES?', W / 2, H * 0.68)
      ctx.restore()

      ctx.font = '600 20px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('Padello – 26 Mar 2026', W / 2, 50)
      ctx.font = '500 14px system-ui, sans-serif'; ctx.fillStyle = '#9ca3af'; ctx.fillText('Tap to join and track scores', W / 2, H - 45)
      ctx.font = '500 13px system-ui, sans-serif'; ctx.fillStyle = '#6b7280'; ctx.fillText('🎾 Padello', W / 2, H - 16)
    }
  },
  {
    name: '4. Neon Grid',
    draw: (ctx, W, H) => {
      ctx.fillStyle = '#0a0014'
      ctx.fillRect(0, 0, W, H)

      // Perspective grid
      ctx.strokeStyle = 'rgba(168,85,247,0.15)'; ctx.lineWidth = 1
      for (let x = 0; x <= W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, H * 0.5); ctx.lineTo(x < W / 2 ? x - 80 : x + 80, H); ctx.stroke()
      }
      for (let y = H * 0.5; y <= H; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Horizon glow
      const hGlow = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.55)
      hGlow.addColorStop(0, 'rgba(236,72,153,0)'); hGlow.addColorStop(0.5, 'rgba(236,72,153,0.3)'); hGlow.addColorStop(1, 'rgba(236,72,153,0)')
      ctx.fillStyle = hGlow; ctx.fillRect(0, H * 0.45, W, H * 0.1)

      // Sun/circle
      ctx.beginPath(); ctx.arc(W / 2, H * 0.38, 80, 0, Math.PI * 2)
      const sunGrad = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, 80)
      sunGrad.addColorStop(0, '#fbbf24'); sunGrad.addColorStop(0.7, '#f97316'); sunGrad.addColorStop(1, 'rgba(249,115,22,0)')
      ctx.fillStyle = sunGrad; ctx.fill()

      // Cut lines through sun (synthwave style)
      ctx.fillStyle = '#0a0014'
      for (let y = H * 0.32; y < H * 0.45; y += 12) {
        ctx.fillRect(W / 2 - 90, y, 180, 4)
      }

      ctx.textAlign = 'center'
      ctx.font = '900 60px system-ui, sans-serif'
      ctx.save(); ctx.shadowColor = 'rgba(236,72,153,0.6)'; ctx.shadowBlur = 25
      ctx.fillStyle = '#ec4899'; ctx.fillText('GAME NIGHT', W / 2, 60)
      ctx.restore()

      ctx.font = '60px serif'; ctx.fillText('🎾', W / 2, H * 0.35)

      ctx.font = '600 20px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('Padello – 26 Mar 2026', W / 2, H * 0.55 + 30)
      ctx.font = '500 14px system-ui, sans-serif'; ctx.fillStyle = '#d1d5db'; ctx.fillText('Tap to join and track scores', W / 2, H - 42)
      ctx.font = '500 13px system-ui, sans-serif'; ctx.fillStyle = '#9ca3af'; ctx.fillText('🎾 Padello', W / 2, H - 14)
    }
  },
  {
    name: '5. Comic Boom',
    draw: (ctx, W, H) => {
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(0, 0, W, H)

      // Radial burst lines
      ctx.save()
      ctx.translate(W / 2, H / 2)
      ctx.fillStyle = '#f59e0b'
      for (let i = 0; i < 20; i++) {
        ctx.beginPath()
        const angle = (i / 20) * Math.PI * 2
        const nextAngle = ((i + 0.5) / 20) * Math.PI * 2
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(angle) * 500, Math.sin(angle) * 500)
        ctx.lineTo(Math.cos(nextAngle) * 500, Math.sin(nextAngle) * 500)
        ctx.closePath(); ctx.fill()
      }
      ctx.restore()

      // White starburst behind text
      ctx.save()
      ctx.translate(W / 2, H / 2 - 10)
      ctx.beginPath()
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 === 0 ? 160 : 120
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill()
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 4; ctx.stroke()
      ctx.restore()

      // SMASH! text
      ctx.textAlign = 'center'
      ctx.font = '900 70px system-ui, sans-serif'
      ctx.save()
      ctx.translate(W / 2, H / 2)
      ctx.rotate(-0.1)
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 8
      ctx.strokeText('SMASH!', 0, 10)
      ctx.fillStyle = '#ef4444'; ctx.fillText('SMASH!', 0, 10)
      ctx.restore()

      // Emoji accents
      ctx.font = '50px serif'
      ctx.fillText('💥', 100, 100); ctx.fillText('💥', W - 100, H - 80)
      ctx.fillText('🏓', 90, H - 90); ctx.fillText('🎾', W - 90, 110)

      // Session label - dark pill
      const labelText = 'Padello – 26 Mar 2026'
      ctx.font = '600 18px system-ui, sans-serif'
      const lw = ctx.measureText(labelText).width
      roundRect(ctx, W / 2 - lw / 2 - 20, H - 75, lw + 40, 35, 18)
      ctx.fillStyle = '#1a1a1a'; ctx.fill()
      ctx.fillStyle = '#ffffff'; ctx.fillText(labelText, W / 2, H - 52)

      ctx.font = '500 13px system-ui, sans-serif'; ctx.fillStyle = '#1a1a1a'; ctx.fillText('🎾 Padello', W / 2, H - 14)
    }
  },
  {
    name: '6. Minimal Bold',
    draw: (ctx, W, H) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)

      // Accent bar at top
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(0, 0, W, 8)

      // Big text
      ctx.textAlign = 'center'
      ctx.font = '900 90px system-ui, sans-serif'
      ctx.fillStyle = '#0a0a0a'
      ctx.fillText('PADEL UP!', W / 2, H * 0.38)

      // Underline
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(W / 2 - 100, H * 0.42, 200, 6)

      // Session info — league name + date
      ctx.font = '600 22px system-ui, sans-serif'
      ctx.fillStyle = '#0a0a0a'
      ctx.fillText('Friday Padel', W / 2, H * 0.52)
      ctx.font = '400 16px system-ui, sans-serif'
      ctx.fillStyle = '#9ca3af'
      ctx.fillText('26 Mar 2026', W / 2, H * 0.58)

      // Tennis ball (drawn)
      ctx.beginPath()
      ctx.arc(W / 2, H * 0.71, 35, 0, Math.PI * 2)
      ctx.fillStyle = '#c8e632'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(W / 2 - 12, H * 0.71, 30, -0.8, 0.8)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(W / 2 + 12, H * 0.71, 30, Math.PI - 0.8, Math.PI + 0.8)
      ctx.stroke()

      ctx.font = '600 16px system-ui, sans-serif'; ctx.fillStyle = '#4b5563'; ctx.fillText('Join Match · Track Scores · Earn Awards · Crown the Champ', W / 2, H - 50)

      // Footer bar
      ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, H - 35, W, 35)
      ctx.font = '500 13px system-ui, sans-serif'; ctx.fillStyle = '#6b7280'; ctx.fillText('🎾 Padello', W / 2, H - 12)
    }
  },
  {
    name: '7. Trash Talk',
    draw: (ctx, W, H) => {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, W, H)

      // Grunge texture — random dots
      ctx.fillStyle = 'rgba(255,255,255,0.02)'
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * W, y = Math.random() * H, r = Math.random() * 3
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }

      // Red tape stripes
      ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = '#ef4444'
      ctx.translate(W / 2, H / 2); ctx.rotate(-0.15)
      ctx.fillRect(-W, -30, W * 2, 60)
      ctx.restore()

      ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = '#ef4444'
      ctx.translate(W / 2, H / 2); ctx.rotate(0.15)
      ctx.fillRect(-W, -30, W * 2, 60)
      ctx.restore()

      ctx.textAlign = 'center'

      // Skull
      ctx.font = '80px serif'; ctx.fillText('💀', W / 2, H * 0.35)

      // Main text — stacked
      ctx.font = '900 48px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'
      ctx.fillText('CRYING IS', W / 2, H * 0.55)
      ctx.fillStyle = '#ef4444'
      ctx.fillText('ALLOWED', W / 2, H * 0.66)

      ctx.font = '600 18px system-ui, sans-serif'; ctx.fillStyle = '#6b7280'; ctx.fillText('Padello – 26 Mar 2026', W / 2, H - 70)
      ctx.font = '500 14px system-ui, sans-serif'; ctx.fillStyle = '#9ca3af'; ctx.fillText('Tap to join and track scores', W / 2, H - 42)
      ctx.font = '500 13px system-ui, sans-serif'; ctx.fillStyle = '#4b5563'; ctx.fillText('🎾 Padello', W / 2, H - 14)
    }
  },
  {
    name: '8. Hype Party',
    draw: (ctx, W, H) => {
      // Gradient background
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#1e1b4b'); bg.addColorStop(1, '#0f172a')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      // Confetti
      const colors = ['#ef4444', '#3b82f6', '#22c55e', '#fbbf24', '#ec4899', '#a855f7']
      for (let i = 0; i < 60; i++) {
        ctx.save()
        ctx.translate(Math.random() * W, Math.random() * H)
        ctx.rotate(Math.random() * Math.PI)
        ctx.fillStyle = colors[i % colors.length]
        ctx.globalAlpha = 0.4 + Math.random() * 0.4
        ctx.fillRect(0, 0, 4 + Math.random() * 8, 12 + Math.random() * 15)
        ctx.restore()
      }

      ctx.textAlign = 'center'

      // Emojis
      ctx.font = '50px serif'
      ctx.fillText('🎉', 80, 80); ctx.fillText('🚀', W - 80, 80)
      ctx.fillText('⚡', 80, H - 60); ctx.fillText('🎉', W - 80, H - 60)

      ctx.font = '900 60px system-ui, sans-serif'
      ctx.save(); ctx.shadowColor = 'rgba(250,204,21,0.5)'; ctx.shadowBlur = 20
      ctx.fillStyle = '#fbbf24'; ctx.fillText("IT'S GO TIME", W / 2, H * 0.38)
      ctx.restore()

      ctx.font = '70px serif'; ctx.fillText('🎾', W / 2, H * 0.56)

      ctx.font = '600 22px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('Padello – 26 Mar 2026', W / 2, H * 0.68)
      ctx.font = '500 14px system-ui, sans-serif'; ctx.fillStyle = '#d1d5db'; ctx.fillText('Tap to join and track scores', W / 2, H - 42)
      ctx.font = '500 13px system-ui, sans-serif'; ctx.fillStyle = '#9ca3af'; ctx.fillText('🎾 Padello', W / 2, H - 14)
    }
  },
]

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export default function CardPreview() {
  const [selected, setSelected] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = 680; canvas.height = 480
    ctx.clearRect(0, 0, 680, 480)
    styles[selected].draw(ctx, 680, 480)
  }, [selected])

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-white">Invite Card Styles</h1>
      <div className="flex flex-wrap gap-2">
        {styles.map((s, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${selected === i ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} className="w-full rounded-xl border border-gray-800" style={{ maxWidth: 680 }} />
    </div>
  )
}
