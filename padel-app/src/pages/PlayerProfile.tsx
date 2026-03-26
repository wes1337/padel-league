import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { usePlayers, useMultiSessionMatches } from '../lib/queries'
import type { Player, Match, Session } from '../types'

interface MatchDetail extends Match {
  sessionLabel: string
  sessionDate: string
  teamSide: 1 | 2
  myScore: number
  oppScore: number
  won: boolean
  partner: string
  partnerId: string
  opp1Id: string
  opp2Id: string
  opp1Name: string
  opp2Name: string
  opponents: string
}

// ── Collapsible section with tooltip ─────────────────────────────────────────
function Section({ title, tooltip, children, defaultOpen = true, collapsible = true }: {
  title: string
  tooltip: string
  children: React.ReactNode
  defaultOpen?: boolean
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [showTip, setShowTip] = useState(false)
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => { setShowTip(v => !v); }}
          className="flex items-center gap-2 text-white font-semibold text-left"
        >
          {title}
          <span className="text-gray-500 text-xs bg-gray-800 rounded-full w-4 h-4 flex items-center justify-center shrink-0">i</span>
        </button>
        {collapsible && (
          <button onClick={() => setOpen(v => !v)} className="text-gray-400 text-sm px-2">
            {open ? '▲' : '▼'}
          </button>
        )}
      </div>
      {showTip && (
        <div className="px-4 py-2 bg-gray-800/50 text-gray-400 text-xs border-b border-gray-800">
          {tooltip}
        </div>
      )}
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

// ── Small stat row ────────────────────────────────────────────────────────────
function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-800 last:border-0 gap-4">
      <span className="text-gray-400 text-sm shrink-0">{label}</span>
      <div className="text-right">
        <span className="text-white font-semibold text-sm">{value}</span>
        {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Player row with W/L bar ───────────────────────────────────────────────────
function PlayerStatRow({ name, wins, losses, diff, highlight, context }: { name: string; wins: number; losses: number; diff?: number; highlight?: 'green' | 'red'; context?: 'together' | 'against' }) {
  const total = wins + losses
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0
  const label = context === 'together' ? `${total} ${total === 1 ? 'game' : 'games'} together` : context === 'against' ? `${total} ${total === 1 ? 'game' : 'games'} against` : `${wins}W ${losses}L`
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${highlight === 'green' ? 'text-green-400' : highlight === 'red' ? 'text-red-400' : 'text-white'}`}>{name}</span>
        <p className="text-gray-600 text-xs">{label}</p>
      </div>
      <span className="text-gray-500 text-xs">
        {context === 'together'
          ? <><span className="text-green-400">{wins} won</span> · <span className="text-red-400">{losses} lost</span></>
          : context === 'against'
          ? <><span className="text-green-400">{wins} won</span> · <span className="text-red-400">{losses} lost</span></>
          : <>{wins}W {losses}L</>
        }
      </span>
      {diff !== undefined && (
        <span className={`text-xs w-10 text-right ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
          {diff > 0 ? `+${diff}` : diff}
        </span>
      )}
      <span className={`text-sm font-bold w-12 text-right ${pct >= 50 ? 'text-green-400' : 'text-red-400'}`}>{pct}%</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlayerProfile() {
  const { leagueId, playerId, sessionId } = useParams<{ leagueId: string; playerId: string; sessionId?: string }>()

  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  // ── Raw data (cached) ────────────────────────────────────────────────────
  const { data: allPlayersList = [] } = usePlayers(leagueId)

  const [player, setPlayer] = useState<Player | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  // Fetch the focal player + session list (these are profile-specific queries)
  useEffect(() => {
    setSessionsLoading(true)
    const sessionsQuery = sessionId
      ? supabase.from('sessions').select('*').eq('id', sessionId)
      : supabase.from('sessions').select('*').eq('league_id', leagueId)
          .eq('excluded', false).eq('confirmed', true).gte('date', yearStart).lte('date', yearEnd)

    Promise.all([
      supabase.from('players').select('*').eq('id', playerId).single(),
      sessionsQuery,
    ]).then(([playerRes, sessionsRes]) => {
      if (playerRes.data) setPlayer(playerRes.data as Player)
      setSessions((sessionsRes.data ?? []) as Session[])
      setSessionsLoading(false)
    })
  }, [playerId, sessionId, leagueId, yearStart, yearEnd])

  const sessionIds = sessions.map(s => s.id)
  const { data: allMatches = [], isLoading: matchesLoading } = useMultiSessionMatches(
    sessionIds,
    `profile-${leagueId}-${sessionId ?? `season-${year}`}`
  )

  const loading = sessionsLoading || (sessionIds.length > 0 && matchesLoading)

  // ── Derived state (complex computation) ──────────────────────────────────
  const [matchDetails, setMatchDetails] = useState<MatchDetail[]>([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [regularPlayerIds, setRegularPlayerIds] = useState<Set<string>>(new Set())
  const [kingStats, setKingStats] = useState<{ sessionsTopped: number; sessionsAttended: number } | null>(null)
  const [rankHistory, setRankHistory] = useState<Record<string, number | string>[]>([])
  const [allPlayerNames, setAllPlayerNames] = useState<{ id: string; name: string }[]>([])
  const [highlightedIds, setHighlightedIds] = useState<Map<string, string>>(new Map())
  const [sessionRank, setSessionRank] = useState<{ rank: number; total: number } | null>(null)
  const [sessionAvg, setSessionAvg] = useState<{ scored: number; conceded: number } | null>(null)

  useEffect(() => {
    if (!player || allPlayersList.length === 0 || sessionsLoading) return
    if (sessions.length === 0) { setTotalSessions(0); setMatchDetails([]); return }
    if (sessionIds.length > 0 && matchesLoading) return

    const pMap = new Map<string, Player>()
    for (const p of allPlayersList) pMap.set(p.id, p as Player)

    setTotalSessions(sessions.length)

    const sessionMap = new Map<string, Session>()
    for (const s of sessions) sessionMap.set(s.id, s)

    // Compute attendance for every player — sessions attended / total sessions
    const playerSessionsMap = new Map<string, Set<string>>()
    for (const m of allMatches as Match[]) {
      for (const pid of [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2]) {
        if (!playerSessionsMap.has(pid)) playerSessionsMap.set(pid, new Set())
        playerSessionsMap.get(pid)!.add(m.session_id)
      }
    }
    const regularIds = new Set<string>()
    for (const [pid, sessionSet] of playerSessionsMap) {
      if (sessionSet.size / sessions.length > 0.5) regularIds.add(pid)
    }
    setRegularPlayerIds(regularIds)

    const details: MatchDetail[] = []
    for (const m of allMatches as Match[]) {
      const isT1 = m.team1_p1 === playerId || m.team1_p2 === playerId
      const isT2 = m.team2_p1 === playerId || m.team2_p2 === playerId
      if (!isT1 && !isT2) continue
      const s = sessionMap.get(m.session_id)
      if (!s) continue
      const side = isT1 ? 1 : 2
      const myScore = side === 1 ? m.team1_score : m.team2_score
      const oppScore = side === 1 ? m.team2_score : m.team1_score
      const partnerId = side === 1
        ? (m.team1_p1 === playerId ? m.team1_p2 : m.team1_p1)
        : (m.team2_p1 === playerId ? m.team2_p2 : m.team2_p1)
      const opp1Id = side === 1 ? m.team2_p1 : m.team1_p1
      const opp2Id = side === 1 ? m.team2_p2 : m.team1_p2
      details.push({
        ...m,
        sessionLabel: s.label || s.date,
        sessionDate: s.date,
        teamSide: side,
        myScore, oppScore,
        won: myScore > oppScore,
        partnerId,
        partner: pMap.get(partnerId)?.name ?? '?',
        opp1Id, opp2Id,
        opp1Name: pMap.get(opp1Id)?.name ?? '?',
        opp2Name: pMap.get(opp2Id)?.name ?? '?',
        opponents: `${pMap.get(opp1Id)?.name ?? '?'} & ${pMap.get(opp2Id)?.name ?? '?'}`,
      })
    }

    details.sort((a, b) =>
      new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime() ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    setMatchDetails(details)

    // Season rank trendline (season mode only)
    if (!sessionId && allMatches.length >= 0) {
      const chronoSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const sessionsWithMatches = chronoSessions.filter(s => (allMatches as Match[]).some(m => m.session_id === s.id))
      const allPlayers = allPlayersList as Player[]

      const history: Record<string, number | string>[] = []
      for (let i = 0; i < sessionsWithMatches.length; i++) {
        const cumulativeSessionIds = new Set(sessionsWithMatches.slice(0, i + 1).map(s => s.id))
        const cumulativeMatches = (allMatches as Match[]).filter(m => cumulativeSessionIds.has(m.session_id))
        const stats = computeStats(allPlayers, cumulativeMatches, i + 1, true)
        const point: Record<string, number | string> = {
          label: sessionsWithMatches[i].label?.replace(/^(Session|Padello) – /, '') ?? sessionsWithMatches[i].date
        }
        stats.forEach((s, idx) => { point[s.player.id] = idx + 1 })
        history.push(point)
      }
      const playerIds = new Set<string>()
      history.forEach(h => Object.keys(h).filter(k => k !== 'label').forEach(k => playerIds.add(k)))
      // Count sessions each player appeared in and apply 30% threshold
      const playerSessionCounts = new Map<string, number>()
      history.forEach(h => {
        Object.keys(h).filter(k => k !== 'label').forEach(k => {
          playerSessionCounts.set(k, (playerSessionCounts.get(k) ?? 0) + 1)
        })
      })
      const totalSess = sessionsWithMatches.length
      const names = (allPlayersList as Player[])
        .filter(p => playerIds.has(p.id) && (playerSessionCounts.get(p.id) ?? 0) / totalSess >= 0.3)

      // Prepend a 'Start' point with all players at the midpoint rank
      const midRank = Math.ceil(names.length / 2)
      const startPoint: Record<string, number | string> = { label: 'Start' }
      names.forEach(p => { startPoint[p.id] = midRank })
      setRankHistory([startPoint, ...history])
      setAllPlayerNames(names)
      setHighlightedIds(new Map([[playerId!, '#22c55e']]))
    }

    // Session rank + averages
    if (sessionId) {
      const sMap = new Map<string, { wins: number; pointDiff: number; scored: number; conceded: number }>()
      for (const m of allMatches as Match[]) {
        const t1Won = m.team1_score > m.team2_score
        for (const pid of [m.team1_p1, m.team1_p2]) {
          if (!sMap.has(pid)) sMap.set(pid, { wins: 0, pointDiff: 0, scored: 0, conceded: 0 })
          const s = sMap.get(pid)!
          if (t1Won) s.wins++
          s.scored += m.team1_score; s.conceded += m.team2_score
          s.pointDiff += m.team1_score - m.team2_score
        }
        for (const pid of [m.team2_p1, m.team2_p2]) {
          if (!sMap.has(pid)) sMap.set(pid, { wins: 0, pointDiff: 0, scored: 0, conceded: 0 })
          const s = sMap.get(pid)!
          if (!t1Won) s.wins++
          s.scored += m.team2_score; s.conceded += m.team1_score
          s.pointDiff += m.team2_score - m.team1_score
        }
      }
      const ranked = [...sMap.entries()].sort((a, b) => b[1].wins - a[1].wins || b[1].pointDiff - a[1].pointDiff)
      const rank = ranked.findIndex(([id]) => id === playerId)
      if (rank !== -1) setSessionRank({ rank: rank + 1, total: ranked.length })

      const allScored = [...sMap.values()].map(s => s.scored)
      const allConceded = [...sMap.values()].map(s => s.conceded)
      setSessionAvg({
        scored: Math.round(allScored.reduce((a, b) => a + b, 0) / allScored.length),
        conceded: Math.round(allConceded.reduce((a, b) => a + b, 0) / allConceded.length),
      })

    }

    // Compute King of the Court
    const sessionsAttendedSet = new Set(details.map(d => d.session_id))
    let sessionsTopped = 0
    for (const session of sessions) {
      const sessionMatches = (allMatches as Match[]).filter(m => m.session_id === session.id)
      if (sessionMatches.length === 0 || !sessionsAttendedSet.has(session.id)) continue
      const sessionStatMap = new Map<string, { wins: number; pointDiff: number }>()
      for (const m of sessionMatches) {
        for (const pid of [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2]) {
          if (!sessionStatMap.has(pid)) sessionStatMap.set(pid, { wins: 0, pointDiff: 0 })
        }
        const team1Won = m.team1_score > m.team2_score
        for (const pid of [m.team1_p1, m.team1_p2]) {
          const s = sessionStatMap.get(pid)!
          if (team1Won) s.wins++
          s.pointDiff += m.team1_score - m.team2_score
        }
        for (const pid of [m.team2_p1, m.team2_p2]) {
          const s = sessionStatMap.get(pid)!
          if (!team1Won) s.wins++
          s.pointDiff += m.team2_score - m.team1_score
        }
      }
      const sorted = [...sessionStatMap.entries()].sort((a, b) => {
        if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins
        return b[1].pointDiff - a[1].pointDiff
      })
      if (sorted[0]?.[0] === playerId) sessionsTopped++
    }
    setKingStats({ sessionsTopped, sessionsAttended: sessionsAttendedSet.size })
  }, [player, allPlayersList, sessions, allMatches, sessionsLoading, matchesLoading, playerId, sessionId])

  if (loading) return <div className="flex justify-center items-center min-h-screen text-gray-400">Loading...</div>
  if (!player) return <div className="flex justify-center items-center min-h-screen text-red-400">Player not found.</div>

  // ── Core stats ──────────────────────────────────────────────────────────────
  const wins = matchDetails.filter(m => m.won).length
  const losses = matchDetails.filter(m => !m.won).length
  const totalPlayed = matchDetails.length
  const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0
  const pointDiff = matchDetails.reduce((acc, m) => acc + (m.myScore - m.oppScore), 0)
  const sessionsAttended = new Set(matchDetails.map(m => m.session_id)).size
  const attendancePct = totalSessions > 0 ? Math.round((sessionsAttended / totalSessions) * 100) : 0
  const lowAttendance = attendancePct <= 50

  // ── Scoring ─────────────────────────────────────────────────────────────────
  const totalScored = matchDetails.reduce((a, m) => a + m.myScore, 0)
  const totalConceded = matchDetails.reduce((a, m) => a + m.oppScore, 0)
  const avgScored = totalPlayed > 0 ? (totalScored / totalPlayed).toFixed(1) : '–'
  const avgConceded = totalPlayed > 0 ? (totalConceded / totalPlayed).toFixed(1) : '–'
  const biggestWin = matchDetails.filter(m => m.won).sort((a, b) => (b.myScore - b.oppScore) - (a.myScore - a.oppScore))[0]
  const heaviestLoss = matchDetails.filter(m => !m.won).sort((a, b) => (b.oppScore - b.myScore) - (a.oppScore - a.myScore))[0]


  // ── Partner chemistry ───────────────────────────────────────────────────────
  const partnerMap = new Map<string, { name: string; wins: number; losses: number; diff: number }>()
  for (const m of matchDetails) {
    if (!partnerMap.has(m.partnerId)) partnerMap.set(m.partnerId, { name: m.partner, wins: 0, losses: 0, diff: 0 })
    const p = partnerMap.get(m.partnerId)!
    m.won ? p.wins++ : p.losses++
    p.diff += m.myScore - m.oppScore
  }
  const partners = [...partnerMap.entries()]
    .filter(([id]) => regularPlayerIds.has(id))
    .map(([, v]) => v)
    .sort((a, b) => {
      const pctA = (a.wins / (a.wins + a.losses)) || 0
      const pctB = (b.wins / (b.wins + b.losses)) || 0
      return pctB - pctA || (b.wins + b.losses) - (a.wins + a.losses) || b.diff - a.diff
    })
  const bestPartner = partners[0]
  const worstPartner = partners[partners.length - 1]

  // ── Rivals (H2H vs opponents) ───────────────────────────────────────────────
  const rivalMap = new Map<string, { name: string; wins: number; losses: number; diff: number }>()
  for (const m of matchDetails) {
    for (const [id, name] of [[m.opp1Id, m.opp1Name], [m.opp2Id, m.opp2Name]] as [string, string][]) {
      if (!rivalMap.has(id)) rivalMap.set(id, { name, wins: 0, losses: 0, diff: 0 })
      const r = rivalMap.get(id)!
      m.won ? r.wins++ : r.losses++
      r.diff += m.myScore - m.oppScore
    }
  }
  const rivals = [...rivalMap.entries()]
    .filter(([id]) => regularPlayerIds.has(id))
    .map(([, v]) => v)
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
  const qualifiedRivals = [...rivalMap.entries()].filter(([id]) => regularPlayerIds.has(id)).map(([, v]) => v).filter(r => r.wins + r.losses >= 3)
  const favVictim = [...qualifiedRivals].sort((a, b) => {
    const winRateA = a.wins / (a.wins + a.losses)
    const winRateB = b.wins / (b.wins + b.losses)
    return winRateB - winRateA
  })[0] ?? undefined
  const nemesis = [...qualifiedRivals].sort((a, b) => {
    const lossRateA = a.losses / (a.wins + a.losses)
    const lossRateB = b.losses / (b.wins + b.losses)
    return lossRateB - lossRateA
  })[0] ?? undefined

  // ── Streaks ─────────────────────────────────────────────────────────────────
  const chronological = [...matchDetails].reverse()
  let longestWinStreak = 0, currentRun = 0
  for (const m of chronological) {
    if (m.won) { currentRun++; longestWinStreak = Math.max(longestWinStreak, currentRun) }
    else currentRun = 0
  }
  // Current streak (from most recent)
  let currentStreak = 0, currentStreakType: 'W' | 'L' | null = null
  for (const m of matchDetails) {
    if (currentStreakType === null) currentStreakType = m.won ? 'W' : 'L'
    if ((m.won && currentStreakType === 'W') || (!m.won && currentStreakType === 'L')) currentStreak++
    else break
  }

  // ── Session history ─────────────────────────────────────────────────────────
  const sessionStatsMap = new Map<string, { id: string; label: string; date: string; wins: number; losses: number; diff: number }>()
  for (const m of matchDetails) {
    if (!sessionStatsMap.has(m.session_id)) {
      sessionStatsMap.set(m.session_id, { id: m.session_id, label: m.sessionLabel, date: m.sessionDate, wins: 0, losses: 0, diff: 0 })
    }
    const ss = sessionStatsMap.get(m.session_id)!
    m.won ? ss.wins++ : ss.losses++
    ss.diff += m.myScore - m.oppScore
  }
  const sessionHistory = [...sessionStatsMap.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const bestSession = [...sessionHistory].sort((a, b) => {
    const pctA = a.wins / (a.wins + a.losses)
    const pctB = b.wins / (b.wins + b.losses)
    return pctB - pctA
  })[0]

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={sessionId ? `/l/${leagueId}/session/${sessionId}` : `/l/${leagueId}`} className="text-gray-400 hover:text-white text-xl">←</Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{player.name}</h1>
            {!sessionId && lowAttendance && <span className="text-yellow-500 text-lg" title="Low attendance">⚠</span>}
          </div>
          <p className="text-gray-400 text-sm">{sessionId ? 'Session stats' : `${new Date().getFullYear()} Season · all stats below are season totals`}</p>
        </div>
      </div>

      {/* Overview grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Matches', value: totalPlayed },
          { label: 'Win Rate', value: `${winRate}%` },
          { label: 'Pt Diff', value: pointDiff > 0 ? `+${pointDiff}` : String(pointDiff) },
          { label: 'Wins', value: wins, color: wins > 0 ? 'text-green-400' : 'text-white' },
          { label: 'Losses', value: losses, color: losses > 0 ? 'text-red-400' : 'text-white' },
          ...(sessionId && sessionRank ? [{ label: 'Session Rank', value: `${sessionRank.rank} / ${sessionRank.total}` }] : []),
          ...(!sessionId ? [{ label: 'Attendance', value: `${attendancePct}%` }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 rounded-xl p-3 flex flex-col gap-0.5">
            <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
            <span className={`${color ?? 'text-white'} text-xl font-bold`}>{value}</span>
          </div>
        ))}
      </div>

      {/* King of the Court */}
      {!sessionId && kingStats && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-4xl">👑</span>
          <div className="flex-1">
            <p className="text-yellow-400 font-bold text-sm uppercase tracking-wide">Court Champion</p>
            <p className="text-white text-2xl font-bold mt-0.5">
              {kingStats.sessionsTopped} session{kingStats.sessionsTopped !== 1 ? 's' : ''} topped
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              {kingStats.sessionsAttended > 0
                ? `${Math.round((kingStats.sessionsTopped / kingStats.sessionsAttended) * 100)}% of sessions attended`
                : 'No sessions yet'}
            </p>
          </div>
        </div>
      )}

      {/* Season rank trendline */}
      {!sessionId && rankHistory.length >= 1 && (() => {
        const PALETTE = ['#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#f97316']
        function togglePlayer(id: string) {
          if (id === playerId) return // current player always on
          setHighlightedIds(prev => {
            const next = new Map(prev)
            if (next.has(id)) {
              next.delete(id)
            } else {
              const usedColors = new Set([...next.values()])
              const color = PALETTE.find(c => !usedColors.has(c)) ?? PALETTE[0]
              next.set(id, color)
            }
            return next
          })
        }
        return (
          <div className="bg-gray-900 rounded-2xl p-4">
            <h2 className="font-semibold text-white mb-1">Season Rank Trend</h2>
            <p className="text-gray-500 text-xs mb-3">Tap a line to compare</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rankHistory} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="label" tick={false} tickLine={false} axisLine={false} />
                <YAxis reversed domain={[1, 'dataMax']} tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(val, key) => {
                    const name = allPlayerNames.find(p => p.id === String(key))?.name ?? String(key)
                    return [`#${val}`, name]
                  }}
                />
                {allPlayerNames.map(p => {
                  const color = highlightedIds.get(p.id)
                  const isHighlighted = !!color
                  return (
                    <Line
                      key={p.id}
                      dataKey={p.id}
                      stroke={color ?? '#374151'}
                      strokeWidth={isHighlighted ? 2.5 : 1.5}
                      dot={rankHistory.length === 1 ? { r: 4, fill: color ?? '#374151', strokeWidth: 0 } : isHighlighted ? { r: 3, fill: color, strokeWidth: 0 } : false}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
            {/* Player chips — tap to compare */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-800">
              {allPlayerNames.filter(p => p.id !== playerId).map(p => {
                const color = highlightedIds.get(p.id)
                const active = !!color
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1 transition-colors ${active ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500'}`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? color : '#4b5563' }} />
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Session momentum chart */}
      {sessionId && matchDetails.length > 1 && (() => {
        const chrono = [...matchDetails].reverse()
        let running = 0
        const momentumData = chrono.map((m, i) => {
          running += m.myScore - m.oppScore
          return { game: `G${i + 1}`, diff: running, won: m.won }
        })
        return (
          <div className="bg-gray-900 rounded-2xl p-4">
            <h2 className="font-semibold text-white mb-1">Session Momentum</h2>
            <p className="text-gray-500 text-xs mb-3">Cumulative point diff after each game</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={momentumData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="game" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(val) => [`${Number(val) > 0 ? '+' : ''}${val}`, 'Pt diff']}
                />
                <Line dataKey="diff" stroke="#22c55e" strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    return <circle key={props.key} cx={cx} cy={cy} r={4} fill={payload.won ? '#22c55e' : '#ef4444'} strokeWidth={0} />
                  }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-gray-600 text-xs mt-2">● green = win · ● red = loss</p>
          </div>
        )
      })()}

      {/* Scoring */}
      <Section title="Scoring" tooltip="How many points you score and concede on average, plus your most decisive results." collapsible={false}>
        {sessionId && <StatRow label="Total points scored" value={String(totalScored)} sub={sessionAvg ? `vs session avg ${sessionAvg.scored}` : undefined} />}
        {sessionId && <StatRow label="Total points conceded" value={String(totalConceded)} sub={sessionAvg ? `vs session avg ${sessionAvg.conceded}` : undefined} />}
        <StatRow label="Avg points scored" value={String(avgScored)} sub="per game" />
        <StatRow label="Avg points conceded" value={String(avgConceded)} sub="per game" />
        {biggestWin && (
          <StatRow label="Biggest win" value={`${biggestWin.myScore} – ${biggestWin.oppScore}`} sub={`with ${biggestWin.partner} · vs ${biggestWin.opponents}${sessionId ? '' : ` · ${biggestWin.sessionLabel}`}`} />
        )}
        {heaviestLoss && (
          <StatRow label="Heaviest loss" value={`${heaviestLoss.myScore} – ${heaviestLoss.oppScore}`} sub={`with ${heaviestLoss.partner} · vs ${heaviestLoss.opponents}${sessionId ? '' : ` · ${heaviestLoss.sessionLabel}`}`} />
        )}
      </Section>

      {/* Partner Chemistry — season only */}
      {!sessionId && <Section title="Partner Chemistry" tooltip="Win rate when playing on the same team as each player. Ranked by win %, then games played together." collapsible={false}>
        {partners.length === 0 ? <p className="text-gray-500 text-sm">No data yet.</p> : (
          <>
            {bestPartner && bestPartner !== worstPartner && (
              <div className="flex gap-3 mb-3">
                <div className="flex-1 bg-green-900/30 border border-green-800 rounded-xl p-3 text-center">
                  <p className="text-green-400 text-xs mb-1">Best partner</p>
                  <p className="text-white font-bold">{bestPartner.name}</p>
                  <p className="text-gray-400 text-xs">Won {bestPartner.wins} of {bestPartner.wins + bestPartner.losses} ({Math.round(bestPartner.wins / (bestPartner.wins + bestPartner.losses) * 100)}%)</p>
                </div>
                <div className="flex-1 bg-red-900/30 border border-red-800 rounded-xl p-3 text-center">
                  <p className="text-red-400 text-xs mb-1">Worst partner</p>
                  <p className="text-white font-bold">{worstPartner.name}</p>
                  <p className="text-gray-400 text-xs">Won {worstPartner.wins} of {worstPartner.wins + worstPartner.losses} ({Math.round(worstPartner.wins / (worstPartner.wins + worstPartner.losses) * 100)}%)</p>
                </div>
              </div>
            )}
            {partners.map((p) => (
              <PlayerStatRow
                key={p.name} name={p.name} wins={p.wins} losses={p.losses} diff={p.diff} context="together"
                highlight={p === bestPartner && p !== worstPartner ? 'green' : p === worstPartner && p !== bestPartner ? 'red' : undefined}
              />
            ))}
          </>
        )}
      </Section>}

      {/* Rivals — season only */}
      {!sessionId && <Section title="Head to Head" tooltip="Win rate when playing against each player (as an opponent). Nemesis = opponent you lose to most. Favourite victim = opponent you beat most. Minimum 3 games to qualify." collapsible={false}>
        {rivals.length === 0 ? <p className="text-gray-500 text-sm">No data yet.</p> : (
          <>
            {(nemesis || favVictim) && (
              <div className="flex gap-3 mb-3">
                {favVictim && (
                  <div className="flex-1 bg-green-900/30 border border-green-800 rounded-xl p-3 text-center">
                    <p className="text-green-400 text-xs mb-1">Favourite victim</p>
                    <p className="text-white font-bold">{favVictim.name}</p>
                    <p className="text-gray-400 text-xs">You won {favVictim.wins} of {favVictim.wins + favVictim.losses} ({Math.round(favVictim.wins / (favVictim.wins + favVictim.losses) * 100)}%)</p>
                  </div>
                )}
                {nemesis && (
                  <div className="flex-1 bg-red-900/30 border border-red-800 rounded-xl p-3 text-center">
                    <p className="text-red-400 text-xs mb-1">Nemesis</p>
                    <p className="text-white font-bold">{nemesis.name}</p>
                    <p className="text-gray-400 text-xs">You lost {nemesis.losses} of {nemesis.wins + nemesis.losses} ({Math.round(nemesis.losses / (nemesis.wins + nemesis.losses) * 100)}%)</p>
                  </div>
                )}
              </div>
            )}
            {rivals.map(r => (
              <PlayerStatRow key={r.name} name={r.name} wins={r.wins} losses={r.losses} diff={r.diff} context="against"
                highlight={r === favVictim && r !== nemesis ? 'green' : r === nemesis && r !== favVictim ? 'red' : undefined}
              />
            ))}
          </>
        )}
      </Section>}

      {/* Streaks — season only */}
      {!sessionId && (
        <Section title="Streaks" tooltip="Counts individual matches, not sessions. Current streak = how many matches in a row you've won or lost most recently. Longest win streak = the most consecutive match wins you've had this season." collapsible={false}>
          {currentStreakType && (
            <StatRow
              label="Current streak"
              value={`${currentStreak} ${currentStreakType === 'W' ? 'wins' : 'losses'}`}
              sub={currentStreakType === 'W' ? '🔥' : ''}
            />
          )}
          <StatRow label="Longest win streak" value={`${longestWinStreak} wins`} />
        </Section>
      )}

      {/* Session History — season only */}
      {!sessionId && <Section title="Session History" tooltip="Your results broken down by each session attended this season." defaultOpen={false}>
        {sessionHistory.length === 0 ? <p className="text-gray-500 text-sm">No sessions yet.</p> : (
          <>
            {bestSession && (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-3 mb-3 text-center">
                <p className="text-yellow-400 text-xs mb-1">Best session</p>
                <p className="text-white font-bold">{bestSession.label}</p>
                <p className="text-gray-400 text-xs">{bestSession.wins}W {bestSession.losses}L · {Math.round(bestSession.wins / (bestSession.wins + bestSession.losses) * 100)}% win rate</p>
              </div>
            )}
            {sessionHistory.map(s => {
              const pct = Math.round(s.wins / (s.wins + s.losses) * 100)
              const diff = s.diff
              return (
                <Link key={s.id} to={`/l/${leagueId}/session/${s.id}`} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 -mx-1 px-1 rounded transition-colors">
                  <span className="text-gray-400 text-sm">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">{s.wins}W {s.losses}L</span>
                    <span className={`text-sm font-bold w-10 text-right ${pct >= 50 ? 'text-green-400' : 'text-red-400'}`}>{pct}%</span>
                    <span className={`text-xs w-10 text-right ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                    <span className="text-gray-600 text-xs">→</span>
                  </div>
                </Link>
              )
            })}
          </>
        )}
      </Section>}

      {/* Match History */}
      <Section title="Match History" tooltip="Every match you've played this season, most recent first." defaultOpen={false}>
        {matchDetails.length === 0 ? <p className="text-gray-500 text-sm">No matches this season.</p> : (
          <div className="flex flex-col gap-2">
            {matchDetails.map(m => {
              const diff = m.myScore - m.oppScore
              return (
              <div key={m.id} className="bg-gray-800 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${m.won ? 'bg-green-700 text-green-100' : 'bg-red-800 text-red-100'}`}>
                      {m.won ? 'W' : 'L'}
                    </span>
                    <div>
                      <span className="text-white font-bold">{m.myScore} – {m.oppScore}</span>
                      <span className={`ml-1.5 text-xs ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs">{m.sessionLabel}</span>
                </div>
                <div className="mt-1 text-gray-400 text-xs">
                  With {m.partner} · vs {m.opponents}
                </div>
              </div>
            )})}
          </div>
        )}
      </Section>
    </div>
  )
}
