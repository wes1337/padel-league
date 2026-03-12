import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { isLeagueAdmin, saveLeagueAdmin, saveSessionCreator } from '../lib/admin'
import type { League, Session, Match, Player, PlayerStats } from '../types'
import Leaderboard from '../components/Leaderboard'

export default function LeagueHome() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const navigate = useNavigate()
  const [league, setLeague] = useState<League | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [seasonStats, setSeasonStats] = useState<PlayerStats[]>([])
  const [, setTotalSeasonSessions] = useState(0)
  const [recentTopId, setRecentTopId] = useState<string | undefined>()
  const [recentBottomId, setRecentBottomId] = useState<string | undefined>()
  const [movements, setMovements] = useState<Record<string, number> | undefined>()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showClaimAdmin, setShowClaimAdmin] = useState(false)
  const [claimToken, setClaimToken] = useState('')
  const [claimError, setClaimError] = useState('')
  const [showAdminCode, setShowAdminCode] = useState(false)

  useEffect(() => {
    if (!leagueId) return
    setIsAdmin(isLeagueAdmin(leagueId))
    loadData()
  }, [leagueId])

  async function loadData() {
    setLoading(true)
    // Delete unconfirmed sessions older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('sessions').delete()
      .eq('league_id', leagueId!).eq('confirmed', false).lt('created_at', oneDayAgo)

    const year = new Date().getFullYear()
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const [leagueRes, sessionsRes, playersRes] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', leagueId).single(),
      supabase.from('sessions').select('*').eq('league_id', leagueId).order('date', { ascending: false }),
      supabase.from('players').select('*').eq('league_id', leagueId).order('name'),
    ])

    if (leagueRes.data) {
      setLeague(leagueRes.data)
      // Remember this league for the home page
      const recent: { id: string; name: string }[] = JSON.parse(localStorage.getItem('recent_leagues') || '[]')
      const updated = [{ id: leagueRes.data.id, name: leagueRes.data.name }, ...recent.filter(r => r.id !== leagueRes.data!.id)].slice(0, 5)
      localStorage.setItem('recent_leagues', JSON.stringify(updated))
    }
    if (sessionsRes.data) setSessions(sessionsRes.data)

    // Load all matches for season
    if (sessionsRes.data && sessionsRes.data.length > 0 && playersRes.data) {
      const sessionIds = sessionsRes.data
        .filter((s: Session) => s.date >= yearStart && s.date <= yearEnd && !s.excluded && s.confirmed)
        .map((s: Session) => s.id)

      if (sessionIds.length > 0) {
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .in('session_id', sessionIds)

        if (matches) {
          const sessionIdsWithMatches = sessionIds.filter(id =>
            (matches as Match[]).some(m => m.session_id === id)
          )
          setTotalSeasonSessions(sessionIdsWithMatches.length)
          const stats = computeStats(playersRes.data as Player[], matches as Match[], sessionIdsWithMatches.length, true)
          setSeasonStats(stats)

          // Position movements based on most recent ended session that has matches
          const mostRecentEnded = sessionsRes.data.find((s: Session) => s.confirmed && s.ended && sessionIdsWithMatches.includes(s.id))
          if (mostRecentEnded) {
            const prevSessionIds = sessionIdsWithMatches.filter((id: string) => id !== mostRecentEnded.id)
            const prevMatches = (matches as Match[]).filter(m => prevSessionIds.includes(m.session_id))
            const prevStats = computeStats(playersRes.data as Player[], prevMatches, prevSessionIds.length, true)
            const prevRanks: Record<string, number> = {}
            prevStats.forEach((s, i) => { prevRanks[s.player.id] = i })
            const mvmt: Record<string, number> = {}
            stats.forEach((s, i) => {
              const prev = prevRanks[s.player.id]
              mvmt[s.player.id] = prev === undefined ? Infinity : prev - i // positive = moved up
            })
            setMovements(mvmt)
          }

          // Top/bottom of most recent session for flame/poop
          const recentSessionId = sessionIds[0]
          const recentMatches = (matches as Match[]).filter(m => m.session_id === recentSessionId)
          if (recentMatches.length > 0) {
            const recentStats = computeStats(playersRes.data as Player[], recentMatches)
            setRecentTopId(recentStats[0]?.player.id)
            setRecentBottomId(recentStats[recentStats.length - 1]?.player.id)
          }
        }
      }
    }

    setLoading(false)
  }

  async function createSession() {
    const today = new Date().toISOString().split('T')[0]
    const label = `Session – ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    const pin = String(Math.floor(1000 + Math.random() * 9000))
    const creator_token = crypto.randomUUID()
    const { data, error } = await supabase
      .from('sessions')
      .insert({ league_id: leagueId, date: today, label, pin, creator_token })
      .select()
      .single()
    if (data && !error) {
      saveSessionCreator(data.id, creator_token)
      navigate(`/l/${leagueId}/session/${data.id}`)
    }
  }

  async function claimAdmin() {
    setClaimError('')
    const { data } = await supabase.from('leagues').select('admin_token').eq('id', leagueId!).single()
    if (!data?.admin_token) {
      setClaimError('No admin code exists for this league.')
      return
    }
    if (data.admin_token !== claimToken.trim()) {
      setClaimError('Incorrect admin code.')
      return
    }
    saveLeagueAdmin(leagueId!)
    setIsAdmin(true)
    setShowClaimAdmin(false)
    setClaimToken('')
  }

  async function deleteSession(sId: string) {
    if (!window.confirm('Delete this session and all its matches? This cannot be undone.')) return
    await supabase.from('matches').delete().eq('session_id', sId)
    await supabase.from('sessions').delete().eq('id', sId)
    setSessions(sessions.filter(s => s.id !== sId))
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen text-gray-400">Loading...</div>
  if (!league) return <div className="flex justify-center items-center min-h-screen text-red-400">League not found.</div>

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{league.name}</h1>
        <p className="text-gray-400 text-sm">{new Date().getFullYear()} Season</p>
      </div>

      {/* Season Leaderboard */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <h2 className="font-semibold text-white mb-3">Season Standings</h2>
        {seasonStats.length === 0 ? (
          <p className="text-gray-500 text-sm">No matches played yet this season.</p>
        ) : (
          <Leaderboard stats={seasonStats} leagueId={leagueId!} flamePlayerId={recentTopId} poopPlayerId={recentBottomId} movements={movements} />
        )}
      </div>

      {/* New Session */}
      <button
        onClick={createSession}
        className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-3 text-lg transition-colors"
      >
        + New Session
      </button>

      {/* Past Sessions */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <h2 className="font-semibold text-white mb-3">Sessions</h2>
        {sessions.filter(s => isAdmin || s.confirmed).length === 0 ? (
          <p className="text-gray-500 text-sm">No sessions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.filter(s => isAdmin || s.confirmed).map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <Link
                  to={`/l/${leagueId}/session/${s.id}`}
                  className="flex-1 flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 transition-colors"
                >
                  <span className={`text-sm ${s.excluded ? 'text-gray-500' : !s.confirmed ? 'text-gray-500' : 'text-white'}`}>{s.label || s.date}</span>
                  <div className="flex items-center gap-2">
                    {s.excluded && <span className="text-xs text-yellow-600">excluded</span>}
                    {!s.confirmed && <span className="text-xs text-gray-600">unconfirmed</span>}
                    <span className="text-gray-400 text-sm">→</span>
                  </div>
                </Link>
                {isAdmin && (
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="text-gray-600 hover:text-red-400 bg-gray-800 rounded-xl px-3 py-3 transition-colors text-sm"
                    title="Delete session"
                  >
                    🗑
                  </button>
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
          <p className="text-gray-400 text-xs">Share the code below to give others admin access to this league.</p>
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
            <button
              onClick={() => setShowClaimAdmin(true)}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors text-center"
            >
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
    </div>
  )
}
