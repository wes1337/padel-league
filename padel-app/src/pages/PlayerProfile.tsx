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
  partnerId: string
  opp1Id: string
  opp2Id: string
  opp1Name: string
  opp2Name: string
  opponents: string
}

// ── Collapsible section with tooltip ─────────────────────────────────────────
function Section({ title, tooltip, children, defaultOpen = true }: {
  title: string
  tooltip: string
  children: React.ReactNode
  defaultOpen?: boolean
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
        <button onClick={() => setOpen(v => !v)} className="text-gray-400 text-sm px-2">
          {open ? '▲' : '▼'}
        </button>
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
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="text-right">
        <span className="text-white font-semibold text-sm">{value}</span>
        {sub && <span className="text-gray-500 text-xs ml-1">{sub}</span>}
      </div>
    </div>
  )
}

// ── Player row with W/L bar ───────────────────────────────────────────────────
function PlayerStatRow({ name, wins, losses, highlight }: { name: string; wins: number; losses: number; highlight?: 'green' | 'red' }) {
  const total = wins + losses
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
      <span className={`text-sm font-medium flex-1 ${highlight === 'green' ? 'text-green-400' : highlight === 'red' ? 'text-red-400' : 'text-white'}`}>{name}</span>
      <span className="text-gray-500 text-xs">{wins}W {losses}L</span>
      <span className={`text-sm font-bold w-12 text-right ${pct >= 50 ? 'text-green-400' : 'text-red-400'}`}>{pct}%</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlayerProfile() {
  const { leagueId, playerId } = useParams<{ leagueId: string; playerId: string }>()
  const [player, setPlayer] = useState<Player | null>(null)
  const [matchDetails, setMatchDetails] = useState<MatchDetail[]>([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [playerId])

  async function loadData() {
    setLoading(true)
    const year = new Date().getFullYear()
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const [playerRes, playersRes, sessionsRes] = await Promise.all([
      supabase.from('players').select('*').eq('id', playerId).single(),
      supabase.from('players').select('*').eq('league_id', leagueId),
      supabase.from('sessions').select('*').eq('league_id', leagueId)
        .eq('excluded', false).gte('date', yearStart).lte('date', yearEnd),
    ])

    if (playerRes.data) setPlayer(playerRes.data)
    const pMap = new Map<string, Player>()
    for (const p of (playersRes.data || [])) pMap.set(p.id, p as Player)

    const sessions = (sessionsRes.data || []) as Session[]
    setTotalSessions(sessions.length)
    if (sessions.length === 0) { setLoading(false); return }

    const sessionMap = new Map<string, Session>()
    for (const s of sessions) sessionMap.set(s.id, s)

    const { data: allMatches } = await supabase
      .from('matches').select('*').in('session_id', sessions.map(s => s.id))

    const details: MatchDetail[] = []
    for (const m of (allMatches || []) as Match[]) {
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

    details.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
    setMatchDetails(details)
    setLoading(false)
  }

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
  const lowAttendance = attendancePct < 50

  // ── Scoring ─────────────────────────────────────────────────────────────────
  const avgScored = totalPlayed > 0 ? (matchDetails.reduce((a, m) => a + m.myScore, 0) / totalPlayed).toFixed(1) : '–'
  const avgConceded = totalPlayed > 0 ? (matchDetails.reduce((a, m) => a + m.oppScore, 0) / totalPlayed).toFixed(1) : '–'
  const biggestWin = matchDetails.filter(m => m.won).sort((a, b) => (b.myScore - b.oppScore) - (a.myScore - a.oppScore))[0]
  const heaviestLoss = matchDetails.filter(m => !m.won).sort((a, b) => (b.oppScore - b.myScore) - (a.oppScore - a.myScore))[0]

  // ── Partner chemistry ───────────────────────────────────────────────────────
  const partnerMap = new Map<string, { name: string; wins: number; losses: number }>()
  for (const m of matchDetails) {
    if (!partnerMap.has(m.partnerId)) partnerMap.set(m.partnerId, { name: m.partner, wins: 0, losses: 0 })
    const p = partnerMap.get(m.partnerId)!
    m.won ? p.wins++ : p.losses++
  }
  const partners = [...partnerMap.values()].sort((a, b) => {
    const pctA = (a.wins / (a.wins + a.losses)) || 0
    const pctB = (b.wins / (b.wins + b.losses)) || 0
    return pctB - pctA
  })
  const bestPartner = partners[0]
  const worstPartner = partners[partners.length - 1]

  // ── Rivals (H2H vs opponents) ───────────────────────────────────────────────
  const rivalMap = new Map<string, { name: string; wins: number; losses: number }>()
  for (const m of matchDetails) {
    for (const [id, name] of [[m.opp1Id, m.opp1Name], [m.opp2Id, m.opp2Name]] as [string, string][]) {
      if (!rivalMap.has(id)) rivalMap.set(id, { name, wins: 0, losses: 0 })
      const r = rivalMap.get(id)!
      m.won ? r.wins++ : r.losses++
    }
  }
  const rivals = [...rivalMap.values()].sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
  const nemesis = [...rivalMap.values()].filter(r => r.wins + r.losses >= 3).sort((a, b) => {
    const lossRateA = a.losses / (a.wins + a.losses)
    const lossRateB = b.losses / (b.wins + b.losses)
    return lossRateB - lossRateA
  })[0]
  const favVictim = [...rivalMap.values()].filter(r => r.wins + r.losses >= 3).sort((a, b) => {
    const winRateA = a.wins / (a.wins + a.losses)
    const winRateB = b.wins / (b.wins + b.losses)
    return winRateB - winRateA
  })[0]

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
  const sessionStatsMap = new Map<string, { label: string; date: string; wins: number; losses: number; diff: number }>()
  for (const m of matchDetails) {
    if (!sessionStatsMap.has(m.session_id)) {
      sessionStatsMap.set(m.session_id, { label: m.sessionLabel, date: m.sessionDate, wins: 0, losses: 0, diff: 0 })
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
        <Link to={`/l/${leagueId}`} className="text-gray-400 hover:text-white text-xl">←</Link>
        <h1 className="text-2xl font-bold text-white">{player.name}</h1>
        {lowAttendance && <span className="text-yellow-500 text-lg" title="Low attendance">⚠</span>}
      </div>

      {/* Overview grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Matches', value: totalPlayed },
          { label: 'Win Rate', value: `${winRate}%` },
          { label: 'Pt Diff', value: pointDiff > 0 ? `+${pointDiff}` : String(pointDiff) },
          { label: 'Wins', value: wins },
          { label: 'Losses', value: losses },
          { label: 'Attendance', value: `${attendancePct}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 rounded-xl p-3 flex flex-col gap-0.5">
            <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
            <span className="text-white text-xl font-bold">{value}</span>
          </div>
        ))}
      </div>

      {/* Scoring */}
      <Section title="Scoring" tooltip="How many points you score and concede on average, plus your most decisive results.">
        <StatRow label="Avg points scored" value={String(avgScored)} sub="per game" />
        <StatRow label="Avg points conceded" value={String(avgConceded)} sub="per game" />
        {biggestWin && (
          <StatRow label="Biggest win" value={`${biggestWin.myScore} – ${biggestWin.oppScore}`} sub={`vs ${biggestWin.opponents}`} />
        )}
        {heaviestLoss && (
          <StatRow label="Heaviest loss" value={`${heaviestLoss.myScore} – ${heaviestLoss.oppScore}`} sub={`vs ${heaviestLoss.opponents}`} />
        )}
      </Section>

      {/* Partner Chemistry */}
      <Section title="Partner Chemistry" tooltip="Your win rate with each partner. Best partner highlighted in green, worst in red (minimum 3 games together).">
        {partners.length === 0 ? <p className="text-gray-500 text-sm">No data yet.</p> : (
          <>
            {bestPartner && bestPartner !== worstPartner && (
              <div className="flex gap-3 mb-3">
                <div className="flex-1 bg-green-900/30 border border-green-800 rounded-xl p-3 text-center">
                  <p className="text-green-400 text-xs mb-1">Best partner</p>
                  <p className="text-white font-bold">{bestPartner.name}</p>
                  <p className="text-gray-400 text-xs">{Math.round(bestPartner.wins / (bestPartner.wins + bestPartner.losses) * 100)}% win rate</p>
                </div>
                <div className="flex-1 bg-red-900/30 border border-red-800 rounded-xl p-3 text-center">
                  <p className="text-red-400 text-xs mb-1">Worst partner</p>
                  <p className="text-white font-bold">{worstPartner.name}</p>
                  <p className="text-gray-400 text-xs">{Math.round(worstPartner.wins / (worstPartner.wins + worstPartner.losses) * 100)}% win rate</p>
                </div>
              </div>
            )}
            {partners.map((p, i) => (
              <PlayerStatRow
                key={p.name} name={p.name} wins={p.wins} losses={p.losses}
                highlight={p === bestPartner && p !== worstPartner ? 'green' : p === worstPartner && p !== bestPartner ? 'red' : undefined}
              />
            ))}
          </>
        )}
      </Section>

      {/* Rivals */}
      <Section title="Head to Head" tooltip="Your win/loss record against each opponent. Nemesis = player you lose to most. Favourite victim = player you beat most. Minimum 3 games to qualify.">
        {rivals.length === 0 ? <p className="text-gray-500 text-sm">No data yet.</p> : (
          <>
            {(nemesis || favVictim) && (
              <div className="flex gap-3 mb-3">
                {favVictim && (
                  <div className="flex-1 bg-green-900/30 border border-green-800 rounded-xl p-3 text-center">
                    <p className="text-green-400 text-xs mb-1">Favourite victim</p>
                    <p className="text-white font-bold">{favVictim.name}</p>
                    <p className="text-gray-400 text-xs">{Math.round(favVictim.wins / (favVictim.wins + favVictim.losses) * 100)}% win rate</p>
                  </div>
                )}
                {nemesis && (
                  <div className="flex-1 bg-red-900/30 border border-red-800 rounded-xl p-3 text-center">
                    <p className="text-red-400 text-xs mb-1">Nemesis</p>
                    <p className="text-white font-bold">{nemesis.name}</p>
                    <p className="text-gray-400 text-xs">{Math.round(nemesis.losses / (nemesis.wins + nemesis.losses) * 100)}% loss rate</p>
                  </div>
                )}
              </div>
            )}
            {rivals.map(r => (
              <PlayerStatRow key={r.name} name={r.name} wins={r.wins} losses={r.losses}
                highlight={r === favVictim && r !== nemesis ? 'green' : r === nemesis && r !== favVictim ? 'red' : undefined}
              />
            ))}
          </>
        )}
      </Section>

      {/* Streaks */}
      <Section title="Streaks" tooltip="Your current run of wins or losses, and your longest winning streak this season.">
        {currentStreakType && (
          <StatRow
            label="Current streak"
            value={`${currentStreak} ${currentStreakType === 'W' ? 'wins' : 'losses'}`}
            sub={currentStreakType === 'W' ? '🔥' : ''}
          />
        )}
        <StatRow label="Longest win streak" value={`${longestWinStreak} wins`} />
      </Section>

      {/* Session History */}
      <Section title="Session History" tooltip="Your results broken down by each session attended this season." defaultOpen={false}>
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
                <div key={s.date} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <span className="text-gray-400 text-sm">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">{s.wins}W {s.losses}L</span>
                    <span className={`text-sm font-bold w-10 text-right ${pct >= 50 ? 'text-green-400' : 'text-red-400'}`}>{pct}%</span>
                    <span className={`text-xs w-10 text-right ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </Section>

      {/* Match History */}
      <Section title="Match History" tooltip="Every match you've played this season, most recent first." defaultOpen={false}>
        {matchDetails.length === 0 ? <p className="text-gray-500 text-sm">No matches this season.</p> : (
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
      </Section>
    </div>
  )
}
