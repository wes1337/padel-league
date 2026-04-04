import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { isLeagueAdmin } from '../lib/admin'
import { useSession, useSessionMatches, usePlayers, useLeague, qk } from '../lib/queries'
import type { Match } from '../types'
import Leaderboard from '../components/Leaderboard'
import SessionSummary from '../components/SessionSummary'

function drawInviteCard(leagueName: string, sessionDate: string): Promise<File | null> {
  return new Promise(resolve => {
    const W = 680, H = 480
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { resolve(null); return }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = '#22c55e'
    ctx.fillRect(0, 0, W, 8)

    ctx.textAlign = 'center'
    ctx.font = '900 90px system-ui, sans-serif'
    ctx.fillStyle = '#0a0a0a'
    ctx.fillText('PADEL UP!', W / 2, H * 0.38)

    ctx.fillStyle = '#22c55e'
    ctx.fillRect(W / 2 - 100, H * 0.42, 200, 6)

    ctx.font = '600 22px system-ui, sans-serif'
    ctx.fillStyle = '#0a0a0a'
    ctx.fillText(leagueName, W / 2, H * 0.52)
    ctx.font = '400 16px system-ui, sans-serif'
    ctx.fillStyle = '#9ca3af'
    ctx.fillText(sessionDate, W / 2, H * 0.58)

    ctx.font = '60px serif'
    ctx.fillText('🎾', W / 2, H * 0.73)

    ctx.font = '600 16px system-ui, sans-serif'
    ctx.fillStyle = '#4b5563'
    ctx.fillText('Track Scores · Earn Awards · Crown the Champ', W / 2, H - 50)

    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, H - 35, W, 35)
    ctx.font = '500 13px system-ui, sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText('🎾 Padello', W / 2, H - 12)

    canvas.toBlob(blob => {
      if (!blob) { resolve(null); return }
      resolve(new File([blob], 'padello-invite.png', { type: 'image/png' }))
    }, 'image/png')
  })
}

type EditState = {
  s1: string; s2: string
  p1: string; p2: string; p3: string; p4: string
}

export default function SessionPage() {
  const { leagueId, sessionId } = useParams<{ leagueId: string; sessionId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [rankHighlightedIds, setRankHighlightedIds] = useState<Map<string, string>>(new Map())
  const [unevenExpanded, setUnevenExpanded] = useState(false)

  const { data: session, isLoading: sessionLoading } = useSession(sessionId)
  const { data: matches = [] } = useSessionMatches(sessionId)
  const { data: players = [], isLoading: playersLoading } = usePlayers(leagueId)
  const { data: league } = useLeague(leagueId)

  const [awardsRevealed, setAwardsRevealed] = useState(() =>
    localStorage.getItem(`awards_revealed_${sessionId}`) === '1'
  )

  // Scroll to top when navigating to a session
  useEffect(() => { window.scrollTo(0, 0) }, [sessionId])

  const loading = sessionLoading || playersLoading

  // Auto-end session after 24 hours (skip future sessions)
  useEffect(() => {
    if (!session || session.ended) return
    const today = new Date().toISOString().split('T')[0]
    if (session.date > today) return
    const created = new Date(session.created_at).getTime()
    if (Date.now() - created >= 24 * 60 * 60 * 1000) {
      supabase.from('sessions').update({ ended: true }).eq('id', session.id).then(() => {
        queryClient.invalidateQueries({ queryKey: qk.session(sessionId!) })
      })
    }
  }, [session, sessionId, queryClient])

  const stats = useMemo(() => {
    if (matches.length === 0 || players.length === 0) return []
    return computeStats(players, matches)
  }, [matches, players])

  function startEdit(m: Match) {
    setEditingMatchId(m.id)
    setEditState({
      s1: String(m.team1_score), s2: String(m.team2_score),
      p1: m.team1_p1, p2: m.team1_p2, p3: m.team2_p1, p4: m.team2_p2,
    })
  }

  async function saveEdit(matchId: string) {
    if (!editState) return
    const s1 = parseInt(editState.s1)
    const s2 = parseInt(editState.s2)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return
    const ids = [editState.p1, editState.p2, editState.p3, editState.p4]
    if (new Set(ids).size < 4) return
    await supabase.from('matches').update({
      team1_score: s1, team2_score: s2,
      team1_p1: editState.p1, team1_p2: editState.p2,
      team2_p1: editState.p3, team2_p2: editState.p4,
    }).eq('id', matchId)
    setEditingMatchId(null)
    setEditState(null)
    queryClient.invalidateQueries({ queryKey: ['matches'] })
  }

  async function deleteMatch(matchId: string) {
    if (!window.confirm('Delete this match? This cannot be undone.')) return
    await supabase.from('matches').delete().eq('id', matchId)
    queryClient.invalidateQueries({ queryKey: ['matches'] })
  }

  function revealAwards() {
    localStorage.setItem(`awards_revealed_${sessionId}`, '1')
    setAwardsRevealed(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteSession() {
    if (!window.confirm('Delete this session and all its matches? This cannot be undone.')) return
    await supabase.from('matches').delete().eq('session_id', sessionId!)
    await supabase.from('sessions').delete().eq('id', sessionId!)
    queryClient.invalidateQueries({ queryKey: qk.sessions(leagueId!) })
    navigate(`/l/${leagueId}`)
  }

  async function toggleExcluded() {
    if (!session) return
    const next = !session.excluded
    await supabase.from('sessions').update({ excluded: next }).eq('id', sessionId!)
    queryClient.invalidateQueries({ queryKey: qk.session(sessionId!) })
    queryClient.invalidateQueries({ queryKey: qk.sessions(leagueId!) })
  }

  function getPlayerName(id: string) {
    return players.find(p => p.id === id)?.name ?? id
  }

  function getUnevenWarning(): { allPlayers: { name: string; count: number; diff: number }[]; mode: number } | null {
    if (matches.length === 0) return null
    const counts = new Map<string, number>()
    for (const m of matches) {
      for (const pid of [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2]) {
        counts.set(pid, (counts.get(pid) || 0) + 1)
      }
    }
    // Mode = the most common game count
    const freq = new Map<number, number>()
    for (const n of counts.values()) freq.set(n, (freq.get(n) || 0) + 1)
    let mode = 0, modeCnt = 0
    for (const [val, cnt] of freq) { if (cnt > modeCnt || (cnt === modeCnt && val > mode)) { mode = val; modeCnt = cnt } }
    const hasOutlier = [...counts.values()].some(n => n !== mode)
    if (!hasOutlier) return null
    const allPlayers = [...counts.entries()]
      .map(([id, n]) => ({ name: getPlayerName(id), count: n, diff: n - mode }))
      .sort((a, b) => a.count - b.count)
    return { allPlayers, mode }
  }

  // Detect duplicate matches (same teams + same scores)
  function getDuplicateMatchIds(): Set<string> {
    const dupes = new Set<string>()
    const seen = new Map<string, string[]>()
    for (const m of matches) {
      const t1 = [m.team1_p1, m.team1_p2].sort().join(',')
      const t2 = [m.team2_p1, m.team2_p2].sort().join(',')
      // Normalize team order so A vs B == B vs A with swapped scores
      const [teamA, teamB, sA, sB] = t1 < t2
        ? [t1, t2, m.team1_score, m.team2_score]
        : [t2, t1, m.team2_score, m.team1_score]
      const key = `${teamA}|${teamB}|${sA}-${sB}`
      const existing = seen.get(key)
      if (existing) {
        existing.push(m.id)
        for (const id of existing) dupes.add(id)
      } else {
        seen.set(key, [m.id])
      }
    }
    return dupes
  }

  const unevenWarning = matches.length > 0 ? getUnevenWarning() : null
  const duplicateIds = useMemo(() => getDuplicateMatchIds(), [matches])

  if (loading) return <div className="flex justify-center items-center min-h-screen text-gray-500">Loading...</div>

  const isAdmin = isLeagueAdmin(leagueId!)

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{session?.label || session?.date}</h1>
          <p className="text-gray-500 text-sm">{league?.name ?? 'League'}</p>
          <p className="text-gray-500 text-xs">{matches.length} match{matches.length !== 1 ? 'es' : ''} played</p>
          {session?.excluded && (
            <span className="inline-block text-xs bg-yellow-50 text-yellow-600 border border-yellow-300 rounded-lg px-2 py-1 mt-1">Excluded</span>
          )}
        </div>
        <Link to={`/l/${leagueId}`} className="text-gray-500 hover:text-gray-700 text-sm transition-colors pt-1 shrink-0">← View Season</Link>
      </div>

      {/* Add Match */}
      {!session?.ended && (
        <button
          onClick={() => navigate(`/l/${leagueId}/session/${sessionId}/add-match`)}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-3 text-lg transition-colors"
        >
          + Add Match
        </button>
      )}

      {/* Uneven games warning */}
      {unevenWarning && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3">
          <button onClick={() => setUnevenExpanded(v => !v)} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-yellow-700 text-sm font-semibold">⚠ Uneven games</p>
              <p className="text-yellow-600 text-xs">Expected: {unevenWarning.mode} each</p>
            </div>
            <span className={`text-yellow-600 text-xs transition-transform ${unevenExpanded ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {unevenExpanded && (
            <div className="flex flex-col gap-1 mt-2">
              {unevenWarning.allPlayers.map((o, i) => (
                <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${
                  o.diff > 0 ? 'bg-red-50 border border-red-200' : o.diff < 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <span className={`text-sm font-medium ${o.diff === 0 ? 'text-gray-400' : 'text-gray-900'}`}>{o.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${o.diff === 0 ? 'text-gray-400' : 'text-gray-600'}`}>{o.count}</span>
                    {o.diff !== 0 && (
                      <span className={`text-xs font-bold ${o.diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {o.diff > 0 ? `+${o.diff}` : o.diff}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session Awards — only after reveal */}
      {matches.length > 0 && awardsRevealed && (
        <SessionSummary matches={matches} players={players} stats={stats} sessionLabel={session?.label || session?.date || ''} sessionShortId={session?.short_id} />
      )}

      {/* Session Standings + Charts — only after reveal */}
      {awardsRevealed && stats.length > 0 && (() => {
        const PALETTE = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#f97316']
        const pMap = new Map(players.map(p => [p.id, p.name]))

        const rounds: Match[][] = []
        for (const m of matches) {
          const mPlayers = [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2]
          const last = rounds[rounds.length - 1]
          const lastPlayers = last ? last.flatMap(r => [r.team1_p1, r.team1_p2, r.team2_p1, r.team2_p2]) : []
          if (!last || mPlayers.some(p => lastPlayers.includes(p))) {
            rounds.push([m])
          } else {
            last.push(m)
          }
        }

        const netWins = new Map<string, number>()
        const netPoints = new Map<string, number>()
        const chartPlayerIds = new Set<string>()
        matches.forEach(m => [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2].forEach(id => chartPlayerIds.add(id)))

        const midRank = Math.ceil(chartPlayerIds.size / 2)
        chartPlayerIds.forEach(id => { netWins.set(id, 0); netPoints.set(id, 0) })
        const rankData: Record<string, number | string>[] = [(() => {
          const r: Record<string, number | string> = { game: 'Start' }
          chartPlayerIds.forEach(id => { r[id] = midRank })
          return r
        })()]

        rounds.forEach((round, i) => {
          for (const m of round) {
            const t1Won = m.team1_score > m.team2_score
            const diff = m.team1_score - m.team2_score
            for (const pid of [m.team1_p1, m.team1_p2]) {
              netWins.set(pid, (netWins.get(pid) ?? 0) + (t1Won ? 1 : -1))
              netPoints.set(pid, (netPoints.get(pid) ?? 0) + diff)
            }
            for (const pid of [m.team2_p1, m.team2_p2]) {
              netWins.set(pid, (netWins.get(pid) ?? 0) + (t1Won ? -1 : 1))
              netPoints.set(pid, (netPoints.get(pid) ?? 0) - diff)
            }
          }

          const sorted = [...chartPlayerIds].sort((a, b) =>
            (netWins.get(b) ?? 0) - (netWins.get(a) ?? 0) ||
            (netPoints.get(b) ?? 0) - (netPoints.get(a) ?? 0)
          )
          const rp: Record<string, number | string> = { game: `R${i + 1}` }
          let rank = 1
          sorted.forEach((id, idx) => {
            if (idx > 0) {
              const prev = sorted[idx - 1]
              if (netWins.get(id) !== netWins.get(prev) || netPoints.get(id) !== netPoints.get(prev)) rank = idx + 1
            }
            rp[id] = rank
          })
          rankData.push(rp)
        })

        const chartPlayers = [...chartPlayerIds].map((id, i) => ({ id, name: pMap.get(id) ?? id, color: PALETTE[i % PALETTE.length] }))

        if (rankHighlightedIds.size === 0 && chartPlayers.length > 0) {
          setRankHighlightedIds(new Map(chartPlayers.map(p => [p.id, p.color])))
        }

        function toggleRank(id: string) {
          setRankHighlightedIds(prev => {
            const next = new Map(prev)
            if (next.has(id)) { next.delete(id) } else {
              const usedColors = new Set([...next.values()])
              const color = PALETTE.find(c => !usedColors.has(c)) ?? PALETTE[0]
              next.set(id, color)
            }
            return next
          })
        }

        const tooltipStyle = { contentStyle: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#111827' }, labelStyle: { color: '#6b7280' } }

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
            <div>
              <h2 className="font-semibold text-gray-900 mb-3">Session Standings</h2>
              <Leaderboard stats={stats} leagueId={leagueId!} sessionId={sessionId} crownPlayerId={stats[0]?.player.id} poopPlayerId={stats[stats.length - 1]?.player.id} />
            </div>
            {rounds.length > 1 && (
              <div className="pt-3 border-t border-gray-200 flex flex-col gap-5">
                <div>
                  <p className="text-gray-500 text-sm font-medium mb-3">Rank</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={rankData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <XAxis dataKey="game" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis reversed domain={[1, 'dataMax']} tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} formatter={(val, key) => [`#${val}`, pMap.get(String(key)) ?? String(key)] as [string, string]} />
                      {chartPlayers.map(p => {
                        const color = rankHighlightedIds.get(p.id)
                        const active = !!color
                        return <Line key={p.id} dataKey={p.id} stroke={color ?? '#374151'} strokeWidth={active ? 2.5 : 1.5} dot={active ? { r: 3, fill: color, strokeWidth: 0 } : false} connectNulls />
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chartPlayers.map(p => {
                    const color = rankHighlightedIds.get(p.id)
                    const active = !!color
                    return (
                      <button key={p.id} onClick={() => toggleRank(p.id)}
                        className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1 transition-colors ${active ? 'bg-gray-200 text-gray-900' : 'bg-gray-100 text-gray-500'}`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? color : '#4b5563' }} />
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Match List */}
      {matches.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Matches</h2>
          <div className="flex flex-col gap-3">
            {[...matches].reverse().map((m, i) => {
              const t1Won = m.team1_score > m.team2_score
              const isEditing = editingMatchId === m.id
              const isDupe = duplicateIds.has(m.id)
              const es = editState
              return (
                <div key={m.id} className={`rounded-xl p-3 flex flex-col gap-2 ${isDupe ? 'bg-red-50 border border-red-300' : 'bg-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Game {matches.length - i} · {(league?.scoring_type ?? m.scoring_type) === 'americano' ? 'Americano' : 'Traditional'}
                      {isDupe && <span className="text-red-500 ml-1 normal-case">· Possible duplicate</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <button onClick={() => startEdit(m)} className="text-gray-500 hover:text-gray-700 text-xs transition-colors">Edit</button>
                      )}
                      <button onClick={() => deleteMatch(m.id)} className="text-gray-400 hover:text-red-600 text-sm transition-colors">✕</button>
                    </div>
                  </div>

                  {isEditing && es ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <select value={es.p1} onChange={e => setEditState({ ...es, p1: e.target.value })} className="w-full bg-gray-200 text-gray-900 text-base rounded-lg px-2 py-1.5 outline-none">
                            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select value={es.p2} onChange={e => setEditState({ ...es, p2: e.target.value })} className="w-full bg-gray-200 text-gray-900 text-base rounded-lg px-2 py-1.5 outline-none">
                            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <input type="text" inputMode="numeric" pattern="[0-9]*" className="w-10 bg-gray-200 rounded-lg px-1 py-1.5 text-gray-900 text-center text-base outline-none focus:ring-2 focus:ring-green-500" value={es.s1} onChange={e => setEditState({ ...es, s1: e.target.value })} />
                          <span className="text-gray-500 font-bold">–</span>
                          <input type="text" inputMode="numeric" pattern="[0-9]*" className="w-10 bg-gray-200 rounded-lg px-1 py-1.5 text-gray-900 text-center text-base outline-none focus:ring-2 focus:ring-green-500" value={es.s2} onChange={e => setEditState({ ...es, s2: e.target.value })} />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <select value={es.p3} onChange={e => setEditState({ ...es, p3: e.target.value })} className="w-full bg-gray-200 text-gray-900 text-base rounded-lg px-2 py-1.5 outline-none">
                            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select value={es.p4} onChange={e => setEditState({ ...es, p4: e.target.value })} className="w-full bg-gray-200 text-gray-900 text-base rounded-lg px-2 py-1.5 outline-none">
                            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => saveEdit(m.id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg py-1.5 transition-colors">Save</button>
                        <button onClick={() => { setEditingMatchId(null); setEditState(null) }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm rounded-lg py-1.5 transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 text-sm font-semibold ${t1Won ? 'text-green-600' : 'text-red-600'}`}>
                        {getPlayerName(m.team1_p1)} & {getPlayerName(m.team1_p2)}
                      </div>
                      <div className="font-bold text-lg min-w-[60px] text-center">
                        <span className={t1Won ? 'text-green-600' : 'text-red-600'}>{m.team1_score}</span>
                        <span className="text-gray-500"> – </span>
                        <span className={!t1Won ? 'text-green-600' : 'text-red-600'}>{m.team2_score}</span>
                      </div>
                      <div className={`flex-1 text-sm font-semibold text-right ${!t1Won ? 'text-green-600' : 'text-red-600'}`}>
                        {getPlayerName(m.team2_p1)} & {getPlayerName(m.team2_p2)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reveal Awards button — shown after matches */}
      {matches.length > 0 && !awardsRevealed && (
        <button
          onClick={revealAwards}
          className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl py-4 text-lg transition-colors"
        >
          🏆 Reveal Awards
        </button>
      )}

      {/* Invite players */}
      {!session?.ended && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
          <div className="min-w-0 mr-3">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Invite Players</p>
            <p className="text-gray-500 text-xs">Share the session link so others can join</p>
          </div>
          <button
            onClick={async () => {
              setInviting(true)
              try {
                const shareUrl = session?.short_id
                  ? `${window.location.origin}/s/${session.short_id}`
                  : window.location.href
                const datePart = session?.label?.replace(/^.+ – /, '') || session?.date || ''
                const leagueName = league?.name || 'Padello'
                const text = `🎾 ${leagueName} — ${datePart}\n\nJoin the session, log your scores, and see who takes the crown.\n\n${shareUrl}`
                if (typeof navigator.share === 'function') {
                  let shared = false
                  try {
                    const file = await drawInviteCard(leagueName, datePart)
                    if (file) {
                      const withFile: ShareData = { text, files: [file] }
                      if (navigator.canShare?.(withFile)) {
                        await navigator.share(withFile)
                        shared = true
                      }
                    }
                  } catch (e) {
                    if (e instanceof Error && e.name === 'AbortError') throw e
                    // file share failed — fall through to text share
                  }
                  if (!shared) await navigator.share({ title: session?.label || 'Padello', text })
                } else {
                  navigator.clipboard.writeText(shareUrl)
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 1500)
                }
              } catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') console.error(err)
              }
              setInviting(false)
            }}
            disabled={inviting}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            {linkCopied ? 'Copied!' : inviting ? '...' : 'Invite'}
          </button>
        </div>
      )}

      {/* Session Settings — admin only */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 text-sm font-medium">Exclude from season rankings</p>
              <p className="text-gray-500 text-xs">This session won't count towards season standings</p>
            </div>
            <button
              onClick={toggleExcluded}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                session?.excluded
                  ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {session?.excluded ? 'Re-include' : 'Exclude'}
            </button>
          </div>
          <button onClick={deleteSession} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg py-2 text-sm transition-colors border border-red-300">
            Delete Session
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-2">
        <p className="text-gray-500 text-sm">🎾 Powered by <Link to="/" className="text-green-600 hover:text-green-700 font-semibold transition-colors">Padello</Link></p>
        <Link to="/" className="text-gray-500 hover:text-gray-700 text-xs transition-colors">Start your own league →</Link>
      </div>
    </div>
  )
}
