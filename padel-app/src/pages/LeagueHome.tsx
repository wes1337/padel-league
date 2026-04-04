import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { nanoid } from 'nanoid'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { isLeagueAdmin, saveLeagueAdmin, saveSessionCreator } from '../lib/admin'
import { useLeague, useSeasons, useSessions, usePlayers, useMultiSessionMatches, qk } from '../lib/queries'
import type { Season, Session, Match, Player, PlayerStats } from '../types'
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
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null)
  const [showCreateSeason, setShowCreateSeason] = useState(false)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [creatingSeason, setCreatingSeason] = useState(false)
  const [pastSessionsExpanded, setPastSessionsExpanded] = useState(false)

  // Scroll to top on navigation
  useEffect(() => { window.scrollTo(0, 0) }, [leagueId])

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: league, isLoading: leagueLoading } = useLeague(leagueId)
  const { data: seasons = [], isLoading: seasonsLoading } = useSeasons(leagueId)
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(leagueId)
  const { data: players = [], isLoading: playersLoading } = usePlayers(leagueId)

  // Auto-select active season or most recent
  const activeSeason = useMemo(() => (seasons as Season[]).find(s => !s.ended), [seasons])
  const currentSeason = useMemo(() => {
    if (selectedSeasonId) return (seasons as Season[]).find(s => s.id === selectedSeasonId) ?? null
    return activeSeason ?? (seasons as Season[])[0] ?? null
  }, [seasons, selectedSeasonId, activeSeason])

  // Filter sessions for the selected season
  const seasonSessions = useMemo(() =>
    (sessions as Session[]).filter(s => currentSeason && s.season_id === currentSeason.id),
    [sessions, currentSeason]
  )

  const filteredSessionIds = useMemo(() =>
    seasonSessions
      .filter(s => !s.excluded && s.confirmed)
      .map(s => s.id),
    [seasonSessions]
  )

  const { data: seasonMatches = [], isLoading: matchesLoading } = useMultiSessionMatches(
    filteredSessionIds,
    `${leagueId}-${currentSeason?.id ?? 'none'}`
  )

  const today = new Date().toISOString().split('T')[0]
  const upcomingSessions = useMemo(() =>
    seasonSessions.filter(s => s.date > today && !s.ended).sort((a, b) => a.date.localeCompare(b.date)),
    [seasonSessions, today]
  )
  const pastSessions = useMemo(() =>
    seasonSessions.filter(s => !(s.date > today && !s.ended)),
    [seasonSessions, today]
  )

  // All champion IDs across all ended seasons
  const seasonChampionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of seasons as Season[]) {
      if (s.ended && s.champion_id) ids.add(s.champion_id)
    }
    return ids
  }, [seasons])

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
  async function createSeason() {
    const name = newSeasonName.trim()
    if (!name || creatingSeason) return
    setCreatingSeason(true)
    const { data, error } = await supabase
      .from('seasons')
      .insert({ league_id: leagueId, name })
      .select()
      .single()
    if (data && !error) {
      queryClient.invalidateQueries({ queryKey: qk.seasons(leagueId!) })
      setSelectedSeasonId(data.id)
      setShowCreateSeason(false)
      setNewSeasonName('')
    }
    setCreatingSeason(false)
  }

  async function endSeason() {
    if (!currentSeason || currentSeason.ended) return
    if (!window.confirm(`End "${currentSeason.name}"? The current #1 player will be crowned season champion.`)) return
    const championId = seasonStats[0]?.player.id ?? null
    await supabase.from('seasons').update({ ended: true, champion_id: championId }).eq('id', currentSeason.id)
    queryClient.invalidateQueries({ queryKey: qk.seasons(leagueId!) })
  }

  async function createSession() {
    if (!activeSeason) return
    const date = newSessionDate
    const dateObj = new Date(date + 'T12:00:00')
    const label = `Padello – ${dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    const creator_token = crypto.randomUUID()
    const { data, error } = await supabase
      .from('sessions')
      .insert({ league_id: leagueId, season_id: activeSeason.id, date, label, confirmed: true, creator_token, short_id: nanoid(8) })
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

  function prefetchSession(sessionId: string) {
    queryClient.prefetchQuery({
      queryKey: qk.session(sessionId),
      queryFn: async () => {
        const { data } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
        return data as Session | null
      },
    })
    queryClient.prefetchQuery({
      queryKey: qk.sessionMatches(sessionId),
      queryFn: async () => {
        const { data } = await supabase.from('matches').select('*').eq('session_id', sessionId).order('created_at')
        return (data ?? []) as Match[]
      },
    })
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getPlayerName(id: string) {
    return (players as Player[]).find(p => p.id === id)?.name ?? 'Unknown'
  }

  const coreLoading = leagueLoading || seasonsLoading || sessionsLoading || playersLoading
  const statsLoading = filteredSessionIds.length > 0 && matchesLoading

  if (coreLoading) return <div className="flex justify-center items-center min-h-screen text-gray-500">Loading...</div>
  if (!league) return <div className="flex justify-center items-center min-h-screen text-red-600">League not found.</div>

  const noSeasons = seasons.length === 0
  const viewingEndedSeason = currentSeason?.ended === true

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{league.name}</h1>
          {currentSeason && <p className="text-gray-500 text-sm">{currentSeason.name}{viewingEndedSeason ? ' (Ended)' : ''}</p>}
        </div>
        <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm transition-colors pt-1 shrink-0 whitespace-nowrap">← Home</Link>
      </div>

      {/* Season Selector */}
      {seasons.length > 1 && (
        <div className="flex items-center gap-2">
          <select
            value={currentSeason?.id ?? ''}
            onChange={e => setSelectedSeasonId(e.target.value)}
            className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm outline-none focus:ring-2 focus:ring-green-500"
          >
            {(seasons as Season[]).map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.ended ? '' : ' (Active)'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* No seasons prompt */}
      {noSeasons && isAdmin && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 text-center">
          <p className="text-yellow-700 text-sm font-semibold mb-2">No season yet</p>
          <p className="text-yellow-600 text-xs mb-3">Create a season to start tracking standings</p>
          <button
            onClick={() => setShowCreateSeason(true)}
            className="bg-yellow-500 hover:bg-yellow-400 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            + Create First Season
          </button>
        </div>
      )}

      {/* Share League */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <div className="min-w-0 mr-3">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Invite to League</p>
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

      {/* New Session — only if there's an active season */}
      {activeSeason && !viewingEndedSeason && (
        showCreateSession ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
            <h2 className="font-semibold text-gray-900">New Session</h2>
            <div className="flex flex-col gap-1">
              <label className="text-gray-500 text-xs">Session date</label>
              <input
                type="date"
                value={newSessionDate}
                onChange={e => setNewSessionDate(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-base outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={createSession} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg py-2.5 transition-colors">
                Create
              </button>
              <button onClick={() => { setShowCreateSession(false); setNewSessionDate(new Date().toISOString().split('T')[0]) }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg py-2.5 transition-colors">
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
        )
      )}

      {/* Season Champion Banner — for ended seasons */}
      {viewingEndedSeason && currentSeason?.champion_id && (
        <div className="bg-yellow-50 border border-yellow-400 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <div>
            <p className="text-yellow-700 text-xs uppercase tracking-wide font-semibold">Season Champion</p>
            <p className="text-gray-900 font-bold text-lg">{getPlayerName(currentSeason.champion_id)}</p>
            <p className="text-yellow-600 text-xs">{currentSeason.name}</p>
          </div>
        </div>
      )}

      {/* Season Leaderboard */}
      {currentSeason && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Season Standings</h2>
            <button
              onClick={() => setShowRankingInfo(v => !v)}
              className="text-gray-500 hover:text-gray-700 text-sm w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center transition-colors"
              title="How rankings work"
            >
              i
            </button>
          </div>
          {showRankingInfo && (
            <div className="bg-gray-100 rounded-xl px-3 py-2.5 mb-3 flex flex-col gap-1.5 text-xs text-gray-500">
              <p><span className="text-gray-900 font-medium">Ranking</span> — primary: win rate. Tiebreaker: point differential.</p>
              <p><span className="text-gray-900 font-medium">⚠ badge</span> — player attended between 30–50% of sessions. They appear in the standings but are ranked below all players with 50%+ attendance, regardless of their record.</p>
              <p><span className="text-gray-900 font-medium">Not listed</span> — players who attended fewer than 30% of sessions are excluded from the standings entirely.</p>
            </div>
          )}
          {statsLoading ? (
            <div className="flex flex-col gap-2 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-xl h-12" />
              ))}
            </div>
          ) : seasonStats.length === 0 ? (
            <p className="text-gray-500 text-sm">No matches played yet this season.</p>
          ) : (
            <Leaderboard stats={seasonStats} leagueId={leagueId!} crownPlayerId={recentTopId} poopPlayerId={recentBottomId} movements={movements} seasonChampionIds={seasonChampionIds} />
          )}
        </div>
      )}

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Upcoming</h2>
          <div className="flex flex-col gap-2">
            {upcomingSessions.map((s: Session) => (
              <div key={s.id} className="flex items-center gap-2">
                <Link
                  to={`/l/${leagueId}/session/${s.id}`}
                  onMouseEnter={() => prefetchSession(s.id)}
                  onTouchStart={() => prefetchSession(s.id)}
                  className="flex-1 flex items-center justify-between bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 transition-colors"
                >
                  <span className="text-sm text-gray-900">{s.label || s.date}</span>
                  <span className="text-gray-500 text-sm">→</span>
                </Link>
                {isAdmin && (
                  <button onClick={() => deleteSession(s.id)} className="text-gray-400 hover:text-red-600 bg-gray-100 rounded-xl px-3 py-3 transition-colors text-sm" title="Delete session">🗑</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions */}
      {currentSeason && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <button
            onClick={() => setPastSessionsExpanded(v => !v)}
            className="flex items-center justify-between w-full"
          >
            <h2 className="font-semibold text-gray-900">{upcomingSessions.length > 0 ? 'Past Sessions' : 'Sessions'} {pastSessions.length > 0 && <span className="text-gray-400 font-normal text-sm">({pastSessions.length})</span>}</h2>
            <span className={`text-gray-400 text-sm transition-transform ${pastSessionsExpanded ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {pastSessionsExpanded && (
            pastSessions.length === 0 ? (
              <p className="text-gray-500 text-sm mt-3">No sessions yet.</p>
            ) : (
              <div className="flex flex-col gap-2 mt-3">
                {pastSessions.map((s: Session) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Link
                      to={`/l/${leagueId}/session/${s.id}`}
                      onMouseEnter={() => prefetchSession(s.id)}
                      onTouchStart={() => prefetchSession(s.id)}
                      className="flex-1 flex items-center justify-between bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 transition-colors"
                    >
                      <span className={`text-sm ${s.excluded ? 'text-gray-500' : !s.confirmed ? 'text-gray-500' : 'text-gray-900'}`}>{s.label || s.date}</span>
                      <div className="flex items-center gap-2">
                        {s.excluded && <span className="text-xs text-yellow-600">excluded</span>}
                        <span className="text-gray-500 text-sm">→</span>
                      </div>
                    </Link>
                    {isAdmin && (
                      <button onClick={() => deleteSession(s.id)} className="text-gray-400 hover:text-red-600 bg-gray-100 rounded-xl px-3 py-3 transition-colors text-sm" title="Delete session">🗑</button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Admin Section */}
      {isAdmin ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Admin</h2>
            <span className="text-xs bg-green-50 text-green-600 border border-green-300 rounded-full px-2 py-0.5">Admin</span>
          </div>

          {/* Season Management */}
          <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
            <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold">Season Management</p>

            {/* Create new season */}
            {showCreateSeason ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={e => setNewSeasonName(e.target.value)}
                  placeholder="Season name (e.g. Spring 2026)"
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500"
                  onKeyDown={e => { if (e.key === 'Enter') createSeason() }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={createSeason}
                    disabled={!newSeasonName.trim() || creatingSeason || !!activeSeason}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
                  >
                    {creatingSeason ? '...' : activeSeason ? 'End current season first' : 'Create Season'}
                  </button>
                  <button
                    onClick={() => { setShowCreateSeason(false); setNewSeasonName('') }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg py-2 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateSeason(true)}
                className="w-full bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold rounded-lg py-2 text-sm transition-colors border border-orange-300"
              >
                + New Season
              </button>
            )}

            {/* End current season */}
            {activeSeason && currentSeason?.id === activeSeason.id && (
              <button
                onClick={endSeason}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg py-2 text-sm transition-colors border border-red-300"
              >
                End Season: {activeSeason.name}
              </button>
            )}
          </div>

          {/* Admin code */}
          <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
            <p className="text-gray-500 text-xs">Share this code with trusted players to give them admin access.</p>
            <button
              onClick={() => setShowAdminCode(!showAdminCode)}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg px-3 py-2 transition-colors text-left"
            >
              {showAdminCode ? `Admin code: ${league.admin_token ?? '—'}` : 'Reveal admin code'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
          {!showClaimAdmin ? (
            <button onClick={() => setShowClaimAdmin(true)} className="text-sm text-gray-500 hover:text-gray-700 transition-colors text-center">
              Admin login
            </button>
          ) : (
            <>
              <h2 className="font-semibold text-gray-900 text-sm">Enter admin code</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500"
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
              {claimError && <p className="text-red-600 text-xs">{claimError}</p>}
              <button onClick={() => { setShowClaimAdmin(false); setClaimToken(''); setClaimError('') }} className="text-gray-500 hover:text-gray-700 text-xs transition-colors">
                Cancel
              </button>
            </>
          )}
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
