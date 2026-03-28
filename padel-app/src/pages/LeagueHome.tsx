import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { nanoid } from 'nanoid'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { isLeagueAdmin, saveLeagueAdmin, saveSessionCreator } from '../lib/admin'
import { useLeague, useSessions, usePlayers, useMultiSessionMatches, qk } from '../lib/queries'
import type { Session, Match, Player, PlayerStats } from '../types'
import Leaderboard from '../components/Leaderboard'

export default function LeagueHome() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [isAdmin, setIsAdmin] = useState(false)
  const [showClaimAdmin, setShowClaimAdmin] = useState(false)
  const [claimToken, setClaimToken] = useState('')
  const [claimError, setClaimError] = useState('')
  const [showAdminCode, setShowAdminCode] = useState(false)
  const [showRankingInfo, setShowRankingInfo] = useState(false)
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [newSessionDate, setNewSessionDate] = useState(() => new Date().toISOString().split('T')[0])
  const [linkCopied, setLinkCopied] = useState(false)

  // Scroll to top on navigation
  useEffect(() => { window.scrollTo(0, 0) }, [leagueId])

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: league, isLoading: leagueLoading } = useLeague(leagueId)
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(leagueId)
  const { data: players = [], isLoading: playersLoading } = usePlayers(leagueId)

  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  const filteredSessionIds = useMemo(() =>
    sessions
      .filter((s: Session) => s.date >= yearStart && s.date <= yearEnd && !s.excluded && s.confirmed)
      .map((s: Session) => s.id),
    [sessions, yearStart, yearEnd]
  )

  const { data: seasonMatches = [], isLoading: matchesLoading } = useMultiSessionMatches(
    filteredSessionIds,
    `${leagueId}-${year}`
  )

  const today = new Date().toISOString().split('T')[0]
  const upcomingSessions = useMemo(() =>
    (sessions as Session[]).filter(s => s.date > today && !s.ended).sort((a, b) => a.date.localeCompare(b.date)),
    [sessions, today]
  )
  const pastSessions = useMemo(() =>
    (sessions as Session[]).filter(s => !(s.date > today && !s.ended)),
    [sessions, today]
  )
  const loading = leagueLoading || sessionsLoading || playersLoading ||
    (filteredSessionIds.length > 0 && matchesLoading)

  // ── Side-effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (leagueId) setIsAdmin(isLeagueAdmin(leagueId))
  }, [leagueId])

  useEffect(() => {
    if (!league) return
    const recent: { id: string; name: string }[] = JSON.parse(localStorage.getItem('recent_leagues') || '[]')
    const updated = [{ id: league.id, name: league.name }, ...recent.filter(r => r.id !== league.id)].slice(0, 5)
    localStorage.setItem('recent_leagues', JSON.stringify(updated))
  }, [league])

  // Auto-delete empty sessions older than 24 hours
  useEffect(() => {
    if (sessions.length === 0) return
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    const now = Date.now()
    const oldSessions = (sessions as Session[]).filter(s =>
      now - new Date(s.created_at).getTime() >= TWENTY_FOUR_HOURS
    )
    if (oldSessions.length === 0) return
    // Check which old sessions have zero matches
    const today = new Date().toISOString().split('T')[0]
    Promise.all(oldSessions.map(async s => {
      const { count } = await supabase.from('matches').select('id', { count: 'exact', head: true }).eq('session_id', s.id)
      return { session: s, count: count ?? 0 }
    })).then(async results => {
      const toDelete = results.filter(r => r.count === 0 && r.session.date <= today).map(r => r.session.id)
      const toEnd = results.filter(r => r.count > 0 && !r.session.ended && r.session.date <= today).map(r => r.session.id)
      const changed = toDelete.length > 0 || toEnd.length > 0
      if (toDelete.length > 0) await Promise.all(toDelete.map(id => supabase.from('sessions').delete().eq('id', id)))
      if (toEnd.length > 0) await Promise.all(toEnd.map(id => supabase.from('sessions').update({ ended: true }).eq('id', id)))
      if (changed) {
        queryClient.invalidateQueries({ queryKey: qk.sessions(leagueId!) })
      }
    })
  }, [sessions, leagueId, queryClient])

  // ── Computed season stats ──────────────────────────────────────────────────
  const sessionIdsWithMatches = useMemo(() =>
    filteredSessionIds.filter(id => (seasonMatches as Match[]).some(m => m.session_id === id)),
    [filteredSessionIds, seasonMatches]
  )

  const seasonStats: PlayerStats[] = useMemo(() => {
    if ((players as Player[]).length === 0 || sessionIdsWithMatches.length === 0) return []
    return computeStats(players as Player[], seasonMatches as Match[], sessionIdsWithMatches.length, true)
  }, [players, seasonMatches, sessionIdsWithMatches])

  const movements: Record<string, number> | undefined = useMemo(() => {
    if (sessionIdsWithMatches.length < 2) return undefined
    const prevIds = sessionIdsWithMatches.slice(1)
    const prevMatches = (seasonMatches as Match[]).filter(m => prevIds.includes(m.session_id))
    const prevStats = computeStats(players as Player[], prevMatches, prevIds.length, true)
    const prevRanks: Record<string, number> = {}
    prevStats.forEach((s, i) => { prevRanks[s.player.id] = i })
    const mvmt: Record<string, number> = {}
    seasonStats.forEach((s, i) => {
      const prev = prevRanks[s.player.id]
      mvmt[s.player.id] = prev === undefined ? Infinity : prev - i
    })
    return mvmt
  }, [sessionIdsWithMatches, seasonMatches, players, seasonStats])

  const { recentTopId, recentBottomId } = useMemo(() => {
    if (sessionIdsWithMatches.length === 0) return {}
    const recentSessionId = sessionIdsWithMatches[0]
    const recentMatches = (seasonMatches as Match[]).filter(m => m.session_id === recentSessionId)
    if (recentMatches.length === 0) return {}
    const recentStats = computeStats(players as Player[], recentMatches)
    return {
      recentTopId: recentStats[0]?.player.id,
      recentBottomId: recentStats[recentStats.length - 1]?.player.id,
    }
  }, [sessionIdsWithMatches, seasonMatches, players])

  // ── Actions ────────────────────────────────────────────────────────────────
  async function createSession() {
    const date = newSessionDate
    const dateObj = new Date(date + 'T12:00:00')
    const label = `Padello – ${dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    const creator_token = crypto.randomUUID()
    const { data, error } = await supabase
      .from('sessions')
      .insert({ league_id: leagueId, date, label, confirmed: true, creator_token, short_id: nanoid(8) })
      .select()
      .single()
    if (data && !error) {
      saveSessionCreator(data.id, creator_token)
      queryClient.invalidateQueries({ queryKey: qk.sessions(leagueId!) })
      setShowCreateSession(false)
      setNewSessionDate(new Date().toISOString().split('T')[0])
      navigate(`/l/${leagueId}/session/${data.id}`)
    }
  }

  async function claimAdmin() {
    setClaimError('')
    const { data } = await supabase.from('leagues').select('admin_token').eq('id', leagueId!).single()
    if (!data?.admin_token) { setClaimError('No admin code exists for this league.'); return }
    if (data.admin_token !== claimToken.trim()) { setClaimError('Incorrect admin code.'); return }
    saveLeagueAdmin(leagueId!)
    setIsAdmin(true)
    setShowClaimAdmin(false)
    setClaimToken('')
  }

  async function deleteSession(sId: string) {
    if (!window.confirm('Delete this session and all its matches? This cannot be undone.')) return
    await supabase.from('matches').delete().eq('session_id', sId)
    await supabase.from('sessions').delete().eq('id', sId)
    queryClient.invalidateQueries({ queryKey: qk.sessions(leagueId!) })
    queryClient.invalidateQueries({ queryKey: ['matches'] })
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen text-gray-400">Loading...</div>
  if (!league) return <div className="flex justify-center items-center min-h-screen text-red-400">League not found.</div>

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{league.name}</h1>
          <p className="text-gray-400 text-sm">{year} Season</p>
        </div>
        <Link to="/" className="text-gray-500 hover:text-white text-sm transition-colors pt-1 shrink-0 whitespace-nowrap">← Home</Link>
      </div>

      {/* Share League */}
      <div className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between">
        <div className="min-w-0 mr-3">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Invite to League</p>
          <p className="text-gray-500 text-xs">Share the link so others can join and track scores</p>
        </div>
        <button
          onClick={async () => {
            const shareUrl = `${window.location.origin}/l/${leagueId}`
            const text = `🎾 Join ${league.name} on Padello — track scores, earn awards, and see who's on top!\n\n${shareUrl}`
            if (typeof navigator.share === 'function') {
              try {
                await navigator.share({ title: league.name, text })
              } catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') console.error(err)
              }
            } else {
              navigator.clipboard.writeText(shareUrl)
              setLinkCopied(true)
              setTimeout(() => setLinkCopied(false), 1500)
            }
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          {linkCopied ? 'Copied!' : 'Share'}
        </button>
      </div>

      {/* New Session */}
      {showCreateSession ? (
        <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-white">New Session</h2>
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs">Session date</label>
            <input
              type="date"
              value={newSessionDate}
              onChange={e => setNewSessionDate(e.target.value)}
              className="bg-gray-800 rounded-lg px-4 py-2.5 text-white text-base outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={createSession} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg py-2.5 transition-colors">
              Create
            </button>
            <button onClick={() => { setShowCreateSession(false); setNewSessionDate(new Date().toISOString().split('T')[0]) }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2.5 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreateSession(true)}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-3 text-lg transition-colors"
        >
          + New Session
        </button>
      )}

      {/* Season Leaderboard */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Season Standings</h2>
          <button
            onClick={() => setShowRankingInfo(v => !v)}
            className="text-gray-500 hover:text-gray-300 text-sm w-5 h-5 rounded-full border border-gray-700 flex items-center justify-center transition-colors"
            title="How rankings work"
          >
            i
          </button>
        </div>
        {showRankingInfo && (
          <div className="bg-gray-800 rounded-xl px-3 py-2.5 mb-3 flex flex-col gap-1.5 text-xs text-gray-400">
            <p><span className="text-white font-medium">Ranking</span> — primary: matches won. Tiebreaker: point differential.</p>
            <p><span className="text-white font-medium">⚠ badge</span> — player attended between 30–50% of sessions. They appear in the standings but are ranked below all players with 50%+ attendance, regardless of their record.</p>
            <p><span className="text-white font-medium">Not listed</span> — players who attended fewer than 30% of sessions are excluded from the standings entirely.</p>
          </div>
        )}
        {seasonStats.length === 0 ? (
          <p className="text-gray-500 text-sm">No matches played yet this season.</p>
        ) : (
          <Leaderboard stats={seasonStats} leagueId={leagueId!} crownPlayerId={recentTopId} poopPlayerId={recentBottomId} movements={movements} />
        )}
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-semibold text-white mb-3">Upcoming</h2>
          <div className="flex flex-col gap-2">
            {upcomingSessions.map((s: Session) => (
              <div key={s.id} className="flex items-center gap-2">
                <Link
                  to={`/l/${leagueId}/session/${s.id}`}
                  className="flex-1 flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 transition-colors"
                >
                  <span className="text-sm text-white">{s.label || s.date}</span>
                  <span className="text-gray-400 text-sm">→</span>
                </Link>
                {isAdmin && (
                  <button onClick={() => deleteSession(s.id)} className="text-gray-600 hover:text-red-400 bg-gray-800 rounded-xl px-3 py-3 transition-colors text-sm" title="Delete session">🗑</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <h2 className="font-semibold text-white mb-3">{upcomingSessions.length > 0 ? 'Past Sessions' : 'Sessions'}</h2>
        {pastSessions.length === 0 ? (
          <p className="text-gray-500 text-sm">No sessions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pastSessions.map((s: Session) => (
              <div key={s.id} className="flex items-center gap-2">
                <Link
                  to={`/l/${leagueId}/session/${s.id}`}
                  className="flex-1 flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 transition-colors"
                >
                  <span className={`text-sm ${s.excluded ? 'text-gray-500' : !s.confirmed ? 'text-gray-500' : 'text-white'}`}>{s.label || s.date}</span>
                  <div className="flex items-center gap-2">
                    {s.excluded && <span className="text-xs text-yellow-600">excluded</span>}
                    <span className="text-gray-400 text-sm">→</span>
                  </div>
                </Link>
                {isAdmin && (
                  <button onClick={() => deleteSession(s.id)} className="text-gray-600 hover:text-red-400 bg-gray-800 rounded-xl px-3 py-3 transition-colors text-sm" title="Delete session">🗑</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Section */}
      {isAdmin ? (
        <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Admin</h2>
            <span className="text-xs bg-green-900/50 text-green-400 border border-green-700 rounded-full px-2 py-0.5">Admin</span>
          </div>
          <p className="text-gray-400 text-xs">Share this code with trusted players to give them admin access. Admins can create and delete sessions, end sessions, and exclude sessions from the season rankings.</p>
          <button
            onClick={() => setShowAdminCode(!showAdminCode)}
            className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-2 transition-colors text-left"
          >
            {showAdminCode ? `Admin code: ${league.admin_token ?? '—'}` : 'Reveal admin code'}
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">
          {!showClaimAdmin ? (
            <button onClick={() => setShowClaimAdmin(true)} className="text-sm text-gray-500 hover:text-gray-300 transition-colors text-center">
              Admin login
            </button>
          ) : (
            <>
              <h2 className="font-semibold text-white text-sm">Enter admin code</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Admin code"
                  value={claimToken}
                  onChange={e => { setClaimToken(e.target.value); setClaimError('') }}
                />
                <button
                  onClick={claimAdmin}
                  disabled={!claimToken.trim()}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold px-4 rounded-lg transition-colors"
                >
                  Claim
                </button>
              </div>
              {claimError && <p className="text-red-400 text-xs">{claimError}</p>}
              <button onClick={() => { setShowClaimAdmin(false); setClaimToken(''); setClaimError('') }} className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-2">
        <p className="text-gray-500 text-sm">🎾 Powered by <Link to="/" className="text-green-400 hover:text-green-300 font-semibold transition-colors">Padello</Link></p>
        <Link to="/" className="text-gray-500 hover:text-white text-xs transition-colors">Start your own league →</Link>
      </div>
    </div>
  )
}
