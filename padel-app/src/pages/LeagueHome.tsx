import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import type { League, Session, Match, Player, PlayerStats } from '../types'
import Leaderboard from '../components/Leaderboard'

export default function LeagueHome() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const navigate = useNavigate()
  const [league, setLeague] = useState<League | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [seasonStats, setSeasonStats] = useState<PlayerStats[]>([])
  const [, setTotalSeasonSessions] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!leagueId) return
    loadData()
  }, [leagueId])

  async function loadData() {
    setLoading(true)
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
        .filter((s: Session) => s.date >= yearStart && s.date <= yearEnd && !s.excluded)
        .map((s: Session) => s.id)

      if (sessionIds.length > 0) {
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .in('session_id', sessionIds)

        if (matches) {
          setTotalSeasonSessions(sessionIds.length)
          const stats = computeStats(playersRes.data as Player[], matches as Match[], sessionIds.length, true)
          setSeasonStats(stats)
        }
      }
    }

    setLoading(false)
  }

  async function createSession() {
    const today = new Date().toISOString().split('T')[0]
    const label = `Session – ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    const { data, error } = await supabase
      .from('sessions')
      .insert({ league_id: leagueId, date: today, label })
      .select()
      .single()
    if (data && !error) navigate(`/l/${leagueId}/session/${data.id}`)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen text-gray-400">Loading...</div>
  if (!league) return <div className="flex justify-center items-center min-h-screen text-red-400">League not found.</div>

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{league.name}</h1>
          <p className="text-gray-400 text-sm">{new Date().getFullYear()} Season</p>
        </div>
        <button
          onClick={copyLink}
          className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          {copied ? '✓ Copied!' : '🔗 Share'}
        </button>
      </div>

      {/* Season Leaderboard */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <h2 className="font-semibold text-white mb-3">Season Standings</h2>
        {seasonStats.length === 0 ? (
          <p className="text-gray-500 text-sm">No matches played yet this season.</p>
        ) : (
          <Leaderboard stats={seasonStats} leagueId={leagueId!} />
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
        {sessions.length === 0 ? (
          <p className="text-gray-500 text-sm">No sessions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map(s => (
              <Link
                key={s.id}
                to={`/l/${leagueId}/session/${s.id}`}
                className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 transition-colors"
              >
                <span className={`text-sm ${s.excluded ? 'text-gray-500' : 'text-white'}`}>{s.label || s.date}</span>
                <div className="flex items-center gap-2">
                  {s.excluded && <span className="text-xs text-yellow-600">excluded</span>}
                  <span className="text-gray-400 text-sm">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
