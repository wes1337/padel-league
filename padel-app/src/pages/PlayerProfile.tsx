import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Player, Match, Session } from '../types'

interface MatchDetail extends Match {
  sessionLabel: string
  sessionDate: string
  teamSide: 1 | 2
  myScore: number
  oppScore: number
  won: boolean
  partner: string
  opponents: string
}

export default function PlayerProfile() {
  const { leagueId, playerId } = useParams<{ leagueId: string; playerId: string }>()
  const [player, setPlayer] = useState<Player | null>(null)
  const [matchDetails, setMatchDetails] = useState<MatchDetail[]>([])

  const [totalSeasonMatches, setTotalSeasonMatches] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [playerId])

  async function loadData() {
    setLoading(true)
    const year = new Date().getFullYear()
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const [playerRes, playersRes, sessionsRes] = await Promise.all([
      supabase.from('players').select('*').eq('id', playerId).single(),
      supabase.from('players').select('*').eq('league_id', leagueId),
      supabase.from('sessions').select('*').eq('league_id', leagueId)
        .gte('date', yearStart).lte('date', yearEnd),
    ])

    if (playerRes.data) setPlayer(playerRes.data)
    const pMap = new Map<string, Player>()
    for (const p of (playersRes.data || [])) pMap.set(p.id, p as Player)


    const sessions = (sessionsRes.data || []) as Session[]
    if (sessions.length === 0) { setLoading(false); return }

    const sessionMap = new Map<string, Session>()
    for (const s of sessions) sessionMap.set(s.id, s)

    const { data: allMatches } = await supabase
      .from('matches').select('*').in('session_id', sessions.map(s => s.id))

    const total = (allMatches || []).length
    setTotalSeasonMatches(total)

    const details: MatchDetail[] = []
    for (const m of (allMatches || []) as Match[]) {
      const isT1 = m.team1_p1 === playerId || m.team1_p2 === playerId
      const isT2 = m.team2_p1 === playerId || m.team2_p2 === playerId
      if (!isT1 && !isT2) continue
      const s = sessionMap.get(m.session_id)!
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
        myScore,
        oppScore,
        won: myScore > oppScore,
        partner: pMap.get(partnerId)?.name ?? '?',
        opponents: `${pMap.get(opp1Id)?.name ?? '?'} & ${pMap.get(opp2Id)?.name ?? '?'}`,
      })
    }

    details.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
    setMatchDetails(details)
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen text-gray-400">Loading...</div>
  if (!player) return <div className="flex justify-center items-center min-h-screen text-red-400">Player not found.</div>

  const wins = matchDetails.filter(m => m.won).length
  const losses = matchDetails.filter(m => !m.won).length
  const totalPlayed = matchDetails.length
  const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0
  const pointDiff = matchDetails.reduce((acc, m) => acc + (m.myScore - m.oppScore), 0)
  const attendance = totalSeasonMatches > 0 ? Math.round((totalPlayed / totalSeasonMatches) * 100) : 0
  const lowAttendance = attendance < 50

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link to={`/l/${leagueId}`} className="text-gray-400 hover:text-white text-xl">←</Link>
        <h1 className="text-2xl font-bold text-white">{player.name}</h1>
        {lowAttendance && <span className="text-yellow-500 text-lg" title="Low attendance">⚠</span>}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Matches', value: totalPlayed },
          { label: 'Win Rate', value: `${winRate}%` },
          { label: 'Wins', value: wins },
          { label: 'Losses', value: losses },
          { label: 'Pt Differential', value: pointDiff > 0 ? `+${pointDiff}` : pointDiff },
          { label: 'Attendance', value: `${attendance}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 rounded-xl p-4 flex flex-col gap-1">
            <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
            <span className="text-white text-2xl font-bold">{value}</span>
          </div>
        ))}
      </div>

      {/* Match History */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <h2 className="font-semibold text-white mb-3">Match History</h2>
        {matchDetails.length === 0 ? (
          <p className="text-gray-500 text-sm">No matches this season.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {matchDetails.map(m => (
              <div key={m.id} className="bg-gray-800 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${m.won ? 'bg-green-700 text-green-100' : 'bg-red-800 text-red-100'}`}>
                      {m.won ? 'W' : 'L'}
                    </span>
                    <span className="text-white font-bold">{m.myScore} – {m.oppScore}</span>
                  </div>
                  <span className="text-gray-500 text-xs">{m.sessionLabel}</span>
                </div>
                <div className="mt-1 text-gray-400 text-xs">
                  With {m.partner} · vs {m.opponents}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
