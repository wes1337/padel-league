import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { isLeagueAdmin, isSessionCreator } from '../lib/admin'
import type { Session, Match, Player, PlayerStats } from '../types'
import Leaderboard from '../components/Leaderboard'
import SessionSummary from '../components/SessionSummary'

type EditState = {
  s1: string; s2: string
  p1: string; p2: string; p3: string; p4: string
}

export default function SessionPage() {
  const { leagueId, sessionId } = useParams<{ leagueId: string; sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [rankHighlightedIds, setRankHighlightedIds] = useState<Map<string, string>>(new Map())

  useEffect(() => { loadData() }, [sessionId])

  async function loadData() {
    setLoading(true)
    const [sessionRes, matchesRes, playersRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('matches').select('*').eq('session_id', sessionId).order('created_at'),
      supabase.from('players').select('*').eq('league_id', leagueId).order('name'),
    ])
    if (sessionRes.data) setSession(sessionRes.data as Session)
    const m = matchesRes.data as Match[] || []
    const p = playersRes.data as Player[] || []
    setMatches(m)
    setPlayers(p)
    if (m.length > 0 && p.length > 0) setStats(computeStats(p, m))
    setLoading(false)
  }

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
    if (new Set(ids).size < 4) return // duplicate player
    await supabase.from('matches').update({
      team1_score: s1, team2_score: s2,
      team1_p1: editState.p1, team1_p2: editState.p2,
      team2_p1: editState.p3, team2_p2: editState.p4,
    }).eq('id', matchId)
    setEditingMatchId(null)
    setEditState(null)
    loadData()
  }

  async function deleteMatch(matchId: string) {
    await supabase.from('matches').delete().eq('id', matchId)
    loadData()
  }

  async function endSession() {
    await supabase.from('sessions').update({ ended: true }).eq('id', sessionId!)
    setSession(prev => prev ? { ...prev, ended: true } : prev)
  }

  async function deleteSession() {
    if (!window.confirm('Delete this session and all its matches? This cannot be undone.')) return
    await supabase.from('matches').delete().eq('session_id', sessionId!)
    await supabase.from('sessions').delete().eq('id', sessionId!)
    navigate(`/l/${leagueId}`)
  }

  async function toggleExcluded() {
    if (!session) return
    const next = !session.excluded
    await supabase.from('sessions').update({ excluded: next }).eq('id', sessionId!)
    setSession({ ...session, excluded: next })
  }


  function getPlayerName(id: string) {
    return players.find(p => p.id === id)?.name ?? id
  }

  // Uneven games warning
  function getUnevenWarning(): { lines: string[] } | null {
    if (matches.length === 0) return null
    const counts = new Map<string, number>()
    for (const m of matches) {
      for (const pid of [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2]) {
        counts.set(pid, (counts.get(pid) || 0) + 1)
      }
    }
    const values = Array.from(counts.values())
    const mode = [...counts.values()].sort((a, b) =>
      values.filter(v => v === b).length - values.filter(v => v === a).length
    )[0]
    const outliers = [...counts.entries()].filter(([, n]) => n !== mode)
    if (outliers.length === 0) return null
    const lines = outliers.map(([id, n]) =>
      `${getPlayerName(id)}: ${n} game${n !== 1 ? 's' : ''} (expected ${mode})`
    )
    return { lines }
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen text-gray-400">Loading...</div>

  const isAdmin = isLeagueAdmin(leagueId!)
  const isCreator = isSessionCreator(sessionId!, session?.creator_token)

  const unevenWarning = matches.length > 0 ? getUnevenWarning() : null

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/l/${leagueId}`} className="text-gray-400 hover:text-white text-xl">←</Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{session?.label || session?.date}</h1>
          <p className="text-gray-400 text-sm">{matches.length} match{matches.length !== 1 ? 'es' : ''} played</p>
        </div>
        {session?.excluded && (
          <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-700 rounded-lg px-2 py-1">Excluded</span>
        )}
      </div>

      {/* Session PIN */}
      {session?.pin && (
        <div className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Session PIN</p>
            <p className="text-white text-3xl font-bold tracking-widest">{session.pin}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs max-w-[140px]">Share this PIN so others can join and enter scores</p>
          </div>
        </div>
      )}

      {/* Uneven games warning */}
      {unevenWarning && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl px-4 py-3 flex flex-col gap-1">
          <p className="text-yellow-300 text-sm font-semibold">⚠ Uneven games played</p>
          {unevenWarning.lines.map((line, i) => (
            <p key={i} className="text-yellow-400 text-xs">{line}</p>
          ))}
        </div>
      )}

      {/* Session Awards — only shown after session is ended */}
      {matches.length > 0 && (
        <SessionSummary matches={matches} players={players} stats={stats} sessionLabel={session?.label || session?.date || ''} />
      )}

      {/* Session Standings + Charts */}
      {stats.length > 0 && (() => {
        const PALETTE = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#f97316']
        const pMap = new Map(players.map(p => [p.id, p.name]))

        // Group matches into rounds: a new round starts when a player would appear twice
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

        // Build per-player running totals after each round
        const netWins = new Map<string, number>()
        const netPoints = new Map<string, number>()
        const chartPlayerIds = new Set<string>()
        matches.forEach(m => [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2].forEach(id => chartPlayerIds.add(id)))

        // Start point — everyone at 0 / rank 1
        const g0: Record<string, number | string> = { game: 'Start' }
        chartPlayerIds.forEach(id => { g0[id] = 0; netWins.set(id, 0); netPoints.set(id, 0) })
        const gamesData: Record<string, number | string>[] = [g0]
        const pointsData: Record<string, number | string>[] = [{ ...g0 }]
        const rankData: Record<string, number | string>[] = [(() => {
          const r: Record<string, number | string> = { game: 'Start' }
          chartPlayerIds.forEach(id => { r[id] = 1 })
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
          const label = `R${i + 1}`
          const gp: Record<string, number | string> = { game: label }
          const pp: Record<string, number | string> = { game: label }
          chartPlayerIds.forEach(id => { gp[id] = netWins.get(id)!; pp[id] = netPoints.get(id)! })
          gamesData.push(gp)
          pointsData.push(pp)

          // Dense rank after this round (wins primary, point diff secondary)
          const sorted = [...chartPlayerIds].sort((a, b) =>
            (netWins.get(b) ?? 0) - (netWins.get(a) ?? 0) ||
            (netPoints.get(b) ?? 0) - (netPoints.get(a) ?? 0)
          )
          const rp: Record<string, number | string> = { game: label }
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

        const tooltipStyle = { contentStyle: { background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#9ca3af' } }
        const fmtVal = (val: unknown, key: unknown) => [`${Number(val) > 0 ? '+' : ''}${val}`, pMap.get(String(key)) ?? String(key)] as [string, string]

        return (
          <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">
            <div>
              <h2 className="font-semibold text-white mb-3">Session Standings</h2>
              <Leaderboard stats={stats} leagueId={leagueId!} sessionId={sessionId} />
            </div>
            {rounds.length > 1 && (
              <div className="pt-3 border-t border-gray-800 flex flex-col gap-5">
                {/* Rank chart */}
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-3">Rank</p>
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

                {/* Games chart */}
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-3">Games</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={gamesData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <XAxis dataKey="game" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#4b5563' }} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} formatter={fmtVal} />
                      {chartPlayers.map(p => {
                        const color = rankHighlightedIds.get(p.id)
                        const active = !!color
                        return <Line key={p.id} dataKey={p.id} stroke={color ?? '#374151'} strokeWidth={active ? 2.5 : 1.5} dot={active ? { r: 3, fill: color, strokeWidth: 0 } : false} connectNulls />
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Points chart */}
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-3">Points</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={pointsData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <XAxis dataKey="game" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#4b5563' }} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} formatter={fmtVal} />
                      {chartPlayers.map(p => {
                        const color = rankHighlightedIds.get(p.id)
                        const active = !!color
                        return <Line key={p.id} dataKey={p.id} stroke={color ?? '#374151'} strokeWidth={active ? 2.5 : 1.5} dot={active ? { r: 3, fill: color, strokeWidth: 0 } : false} connectNulls />
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Shared player toggles */}
                <div className="flex flex-wrap gap-2">
                  {chartPlayers.map(p => {
                    const color = rankHighlightedIds.get(p.id)
                    const active = !!color
                    return (
                      <button key={p.id} onClick={() => toggleRank(p.id)}
                        className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1 transition-colors ${active ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500'}`}
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

      {/* Add Match */}
      {!session?.ended && (
        <button
          onClick={() => navigate(`/l/${leagueId}/session/${sessionId}/add-match`)}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-3 text-lg transition-colors"
        >
          + Add Match
        </button>
      )}


      {/* Match List */}
      {matches.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-semibold text-white mb-3">Matches</h2>
          <div className="flex flex-col gap-3">
            {matches.map((m, i) => {
              const t1Won = m.team1_score > m.team2_score
              const isEditing = editingMatchId === m.id
              const es = editState
              return (
                <div key={m.id} className="bg-gray-800 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Game {i + 1} · {m.scoring_type === 'americano' ? 'Americano' : 'Traditional'}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <button onClick={() => startEdit(m)} className="text-gray-500 hover:text-white text-xs transition-colors">Edit</button>
                      )}
                      <button onClick={() => deleteMatch(m.id)} className="text-gray-600 hover:text-red-400 text-sm transition-colors">✕</button>
                    </div>
                  </div>

                  {isEditing && es ? (
                    <div className="flex flex-col gap-2">
                      {/* Team 1 players */}
                      <div className="flex gap-2">
                        <select
                          value={es.p1}
                          onChange={e => setEditState({ ...es, p1: e.target.value })}
                          className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-2 py-1.5 outline-none"
                        >
                          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select
                          value={es.p2}
                          onChange={e => setEditState({ ...es, p2: e.target.value })}
                          className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-2 py-1.5 outline-none"
                        >
                          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      {/* Score */}
                      <div className="flex items-center gap-2 justify-center">
                        <input
                          type="number" min="0" inputMode="numeric"
                          className="w-14 bg-gray-700 rounded-lg px-2 py-1.5 text-white text-center text-sm outline-none focus:ring-2 focus:ring-green-500"
                          value={es.s1} onChange={e => setEditState({ ...es, s1: e.target.value })}
                        />
                        <span className="text-gray-500 font-bold">–</span>
                        <input
                          type="number" min="0" inputMode="numeric"
                          className="w-14 bg-gray-700 rounded-lg px-2 py-1.5 text-white text-center text-sm outline-none focus:ring-2 focus:ring-green-500"
                          value={es.s2} onChange={e => setEditState({ ...es, s2: e.target.value })}
                        />
                      </div>
                      {/* Team 2 players */}
                      <div className="flex gap-2">
                        <select
                          value={es.p3}
                          onChange={e => setEditState({ ...es, p3: e.target.value })}
                          className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-2 py-1.5 outline-none"
                        >
                          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select
                          value={es.p4}
                          onChange={e => setEditState({ ...es, p4: e.target.value })}
                          className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-2 py-1.5 outline-none"
                        >
                          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => saveEdit(m.id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg py-1.5 transition-colors">Save</button>
                        <button onClick={() => { setEditingMatchId(null); setEditState(null) }} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg py-1.5 transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 text-sm font-semibold ${t1Won ? 'text-green-400' : 'text-red-400'}`}>
                        {getPlayerName(m.team1_p1)} & {getPlayerName(m.team1_p2)}
                      </div>
                      <div className="font-bold text-lg min-w-[60px] text-center">
                        <span className={t1Won ? 'text-green-400' : 'text-red-400'}>{m.team1_score}</span>
                        <span className="text-gray-500"> – </span>
                        <span className={!t1Won ? 'text-green-400' : 'text-red-400'}>{m.team2_score}</span>
                      </div>
                      <div className={`flex-1 text-sm font-semibold text-right ${!t1Won ? 'text-green-400' : 'text-red-400'}`}>
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

      {/* Session Settings — admin/creator only */}
      {(isAdmin || isCreator) && (
        <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Exclude from season rankings</p>
              <p className="text-gray-500 text-xs">This session won't count towards season standings</p>
            </div>
            <button
              onClick={toggleExcluded}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                session?.excluded
                  ? 'bg-yellow-700 hover:bg-yellow-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {session?.excluded ? 'Re-include' : 'Exclude'}
            </button>
          </div>
          {!session?.ended && (
            <button
              onClick={endSession}
              className="w-full bg-blue-900/40 hover:bg-blue-900/70 text-blue-400 font-semibold rounded-lg py-2 text-sm transition-colors border border-blue-900"
            >
              End Session
            </button>
          )}
          {session?.ended && (
            <p className="text-gray-500 text-xs text-center">Session ended — standings locked in</p>
          )}
          {isAdmin && (
            <button
              onClick={deleteSession}
              className="w-full bg-red-900/40 hover:bg-red-900/70 text-red-400 font-semibold rounded-lg py-2 text-sm transition-colors border border-red-900"
            >
              Delete Session
            </button>
          )}
        </div>
      )}

    </div>
  )
}
