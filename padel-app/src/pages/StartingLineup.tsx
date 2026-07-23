import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useLeague, useSessions, useSeasons, usePlayers, useMultiSessionMatches, useSession, useSessionMatches } from '../lib/queries'
import { computeStats, isScored } from '../lib/stats'
import { suggestStartingPairs, parseNames, formatLineup, type SeededPlayer, type Court } from '../lib/seeding'
import { courtLabel } from '../lib/courts'
import { courtSeasonStats } from '../lib/insights'
import type { Session, Season, Match, Player } from '../types'

function SourceTag({ source }: { source: SeededPlayer['source'] }) {
  if (source === 'lastweek') return null
  const label = source === 'season' ? 'sub' : 'new'
  const cls = source === 'season'
    ? 'bg-blue-50 text-blue-600 border-blue-200'
    : 'bg-gray-100 text-gray-500 border-gray-200'
  return <span className={`text-[10px] border rounded px-1 py-0.5 ${cls}`}>{label}</span>
}

function PlayerChip({ p }: { p: SeededPlayer }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-semibold text-gray-900">{p.name}</span>
      <SourceTag source={p.source} />
    </span>
  )
}

function EditSlot({ p, selected, onClick }: { p: SeededPlayer; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg px-2 py-1.5 text-sm font-semibold border transition-colors ${
        selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
      }`}
    >
      {p.name}
    </button>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm rounded-full px-3 py-1.5 border transition-colors ${
        on
          ? 'bg-green-600 border-green-600 text-white'
          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {on ? '✓ ' : '+ '}{label}
    </button>
  )
}

export default function StartingLineup() {
  const { leagueId, sessionId } = useParams<{ leagueId: string; sessionId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session } = useSession(sessionId)
  const { data: existingMatches = [] } = useSessionMatches(sessionId)

  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const [guestText, setGuestText] = useState('')
  const [copied, setCopied] = useState(false)
  const [insightCourt, setInsightCourt] = useState<number | null>(null)

  const { data: league } = useLeague(leagueId)
  const { data: seasons = [] } = useSeasons(leagueId)
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(leagueId)
  const { data: players = [], isLoading: playersLoading } = usePlayers(leagueId)

  // Scope standings to ONE season — the same one the app's Season Standings show —
  // so the line-up ranks by the current season, not all-time across every season.
  // Use this session's season when session-scoped, otherwise the active season.
  const currentSeasonId = useMemo(() => {
    const list = seasons as Season[]
    if (session?.season_id) return session.season_id
    return (list.find(s => !s.ended) ?? list[0])?.id ?? null
  }, [seasons, session])

  // Sessions that count toward standings (this season only), most recent first.
  const rankedSessions = useMemo(() =>
    (sessions as Session[])
      .filter(s => !s.excluded && s.confirmed && (!currentSeasonId || s.season_id === currentSeasonId))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [sessions, currentSeasonId]
  )
  const sessionIds = useMemo(() => rankedSessions.map(s => s.id), [rankedSessions])

  const { data: seasonMatchesRaw = [], isSuccess: matchesLoaded } = useMultiSessionMatches(sessionIds, `lineup-${leagueId}-${currentSeasonId ?? 'all'}`)
  // Exclude 0–0 placeholder games (unscored "Apply line-up" round) from standings.
  const seasonMatches = useMemo(() => (seasonMatchesRaw as Match[]).filter(isScored), [seasonMatchesRaw])

  // "Last week" = most recent counted session that actually has scored games.
  const { lastWeekMatches, lastWeekLabel } = useMemo(() => {
    for (const s of rankedSessions) {
      const m = seasonMatches.filter(mm => mm.session_id === s.id)
      if (m.length > 0) return { lastWeekMatches: m, lastWeekLabel: s.label || s.date }
    }
    return { lastWeekMatches: [] as Match[], lastWeekLabel: null as string | null }
  }, [rankedSessions, seasonMatches])

  // Player IDs from last week, in finishing order.
  const lastWeekOrder = useMemo(
    () => computeStats(players as Player[], lastWeekMatches).map(s => s.player.id),
    [players, lastWeekMatches]
  )
  const lastWeekSet = useMemo(() => new Set(lastWeekOrder), [lastWeekOrder])

  const seasonRank = useMemo(() => {
    const m = new Map<string, number>()
    computeStats(players as Player[], seasonMatches as Match[]).forEach((s, i) => m.set(s.player.id, i))
    return m
  }, [players, seasonMatches])

  // Pre-select last week's roster once — but only after every query has settled.
  // Gating on isLoading/isSuccess (not "is the array non-empty") avoids a race
  // where sessions haven't loaded yet, sessionIds is momentarily empty, and we'd
  // otherwise lock in an empty selection before last week's data arrives.
  const ready = !playersLoading && !sessionsLoading && (sessionIds.length === 0 || matchesLoaded)
  useEffect(() => {
    if (initialized || !ready) return
    setSelected(new Set(lastWeekOrder))
    setInitialized(true)
  }, [initialized, ready, lastWeekOrder])

  const playerById = useMemo(() => {
    const m = new Map<string, Player>()
    for (const p of players as Player[]) m.set(p.id, p)
    return m
  }, [players])

  // Chip groups: last week's players (in finish order), then everyone else (by season rank).
  const lastWeekPlayers = useMemo(
    () => lastWeekOrder.map(id => playerById.get(id)).filter((p): p is Player => !!p),
    [lastWeekOrder, playerById]
  )
  const otherPlayers = useMemo(() => {
    return (players as Player[])
      .filter(p => !lastWeekSet.has(p.id))
      .sort((a, b) => {
        const ra = seasonRank.get(a.id), rb = seasonRank.get(b.id)
        if (ra !== undefined && rb !== undefined) return ra - rb
        if (ra !== undefined) return -1
        if (rb !== undefined) return 1
        return a.name.localeCompare(b.name)
      })
  }, [players, lastWeekSet, seasonRank])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const guestNames = useMemo(() => parseNames(guestText), [guestText])

  const names = useMemo(() => {
    const picked = (players as Player[]).filter(p => selected.has(p.id)).map(p => p.name)
    return [...picked, ...guestNames]
  }, [players, selected, guestNames])

  const result = useMemo(() => {
    if (names.length < 4) return null
    return suggestStartingPairs(names, players as Player[], lastWeekMatches, seasonMatches as Match[])
  }, [names, players, lastWeekMatches, seasonMatches])

  // Manual team override. `editedFlat` holds the players as a flat list (4 per
  // court: [pair1a, pair1b, pair2a, pair2b]); null = use the suggestion as-is.
  const [editMode, setEditMode] = useState(false)
  const [editedFlat, setEditedFlat] = useState<SeededPlayer[] | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  // Drop any manual edits when the suggestion changes (roster/guest edits).
  const resultSig = result
    ? result.courts.flatMap(c => [c.pair1[0], c.pair1[1], c.pair2[0], c.pair2[1]]).map(p => p.id ?? p.name).join(',')
    : ''
  useEffect(() => { setEditedFlat(null); setEditMode(false); setSelectedSlot(null) }, [resultSig])

  const displayCourts: Court[] = useMemo(() => {
    if (!editedFlat) return result?.courts ?? []
    const out: Court[] = []
    for (let c = 0; c < editedFlat.length / 4; c++) {
      const s = editedFlat.slice(c * 4, c * 4 + 4)
      out.push({ court: c + 1, pair1: [s[0], s[1]], pair2: [s[2], s[3]] })
    }
    return out
  }, [editedFlat, result])

  function startEditTeams() {
    if (!result) return
    setEditedFlat(result.courts.flatMap(c => [c.pair1[0], c.pair1[1], c.pair2[0], c.pair2[1]]))
    setEditMode(true)
    setSelectedSlot(null)
  }
  function tapSlot(idx: number) {
    if (selectedSlot === null) { setSelectedSlot(idx); return }
    if (selectedSlot === idx) { setSelectedSlot(null); return }
    setEditedFlat(prev => {
      if (!prev) return prev
      const next = [...prev]
      const tmp = next[selectedSlot]; next[selectedSlot] = next[idx]; next[idx] = tmp
      return next
    })
    setSelectedSlot(null)
  }

  async function copyLineup() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(formatLineup({ ...result, courts: displayCourts }, league?.name))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }

  // Courts whose four players are all real league players — only these can be
  // handed to the match-entry screen (guests have no id yet).
  const applicableCourts = useMemo(() =>
    displayCourts.filter(c =>
      [c.pair1[0], c.pair1[1], c.pair2[0], c.pair2[1]].every(p => p.id != null)
    ),
    [displayCourts]
  )
  const canApply = !!sessionId && !session?.ended && applicableCourts.length > 0

  // Create the Round 1 games (teams set, score left as 0–0 to be filled in later).
  async function applyToSession() {
    if (!canApply || applying) return
    if (existingMatches.length > 0 &&
        !window.confirm('This session already has games. Add Round 1 on top of them?')) return
    setApplying(true)
    setApplyError('')
    const scoring = league?.scoring_type ?? 'americano'
    // Stamp the round number (next after any existing games) and court index so
    // the winner-court "next round" logic can move winners up / losers down.
    const nextRoundNo = Math.max(0, ...(existingMatches as Match[]).map(m => m.round ?? 0)) + 1
    const rows = applicableCourts.map((c, i) => ({
      session_id: sessionId,
      scoring_type: scoring,
      team1_p1: c.pair1[0].id!, team1_p2: c.pair1[1].id!,
      team2_p1: c.pair2[0].id!, team2_p2: c.pair2[1].id!,
      team1_score: 0, team2_score: 0,
      round: nextRoundNo, court: i + 1,
    }))
    const { error } = await supabase.from('matches').insert(rows)
    setApplying(false)
    // 23505 = another phone already created this round (unique index). Treat as
    // success — navigate on and show the existing games rather than erroring.
    if (error && error.code !== '23505') { setApplyError('Could not create the games — please try again.'); return }
    queryClient.invalidateQueries({ queryKey: ['matches'] })
    navigate(`/l/${leagueId}/session/${sessionId}`)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Starting line-up</h1>
          <p className="text-gray-500 text-sm">{league?.name ?? 'League'}</p>
        </div>
        <Link to={sessionId ? `/l/${leagueId}/session/${sessionId}` : `/l/${leagueId}`} className="text-gray-500 hover:text-gray-700 text-sm transition-colors pt-1 shrink-0">← Back</Link>
      </div>

      {/* Roster picker */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-4">
        <div>
          <p className="text-gray-900 text-sm font-medium">Who's playing today?</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {lastWeekLabel
              ? `Starting from last week (${lastWeekLabel}). Tap to add or drop players.`
              : 'Tap players to add them to the line-up.'}
          </p>
        </div>

        {lastWeekPlayers.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Last week's line-up</p>
            <div className="flex flex-wrap gap-2">
              {lastWeekPlayers.map(p => (
                <Toggle key={p.id} label={p.name} on={selected.has(p.id)} onClick={() => toggle(p.id)} />
              ))}
            </div>
          </div>
        )}

        {otherPlayers.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-gray-500 text-xs uppercase tracking-wide">
              {lastWeekPlayers.length > 0 ? 'Subs / others' : 'Players'}
            </p>
            <div className="flex flex-wrap gap-2">
              {otherPlayers.map(p => (
                <Toggle key={p.id} label={p.name} on={selected.has(p.id)} onClick={() => toggle(p.id)} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-gray-500 text-xs uppercase tracking-wide">Guests (not in the league)</label>
          <input
            type="text"
            value={guestText}
            onChange={e => setGuestText(e.target.value)}
            placeholder="e.g. Sam, Alex"
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-base outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <p className="text-gray-500 text-xs">{names.length} playing{names.length % 4 !== 0 ? ` · ${names.length % 4} will sit out game 1` : ''}</p>
      </div>

      {/* Result */}
      {result ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Opening courts</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => (editMode ? setEditMode(false) : startEditTeams())}
                className="text-gray-600 bg-gray-100 hover:bg-gray-200 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
              >
                {editMode ? 'Done' : 'Edit teams'}
              </button>
              <button
                onClick={copyLineup}
                className="text-white bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {editMode ? (
            <p className="text-blue-700 text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              Tap two players to swap them — across any courts. Tap Done when you're happy.
            </p>
          ) : lastWeekMatches.length === 0 && (seasonMatches as Match[]).length === 0 && (
            <p className="text-gray-500 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              No match history yet — courts are seeded in selection order.
            </p>
          )}

          <div className="flex flex-col gap-2">
            {displayCourts.map(court => {
              const base = (court.court - 1) * 4
              const slots = [court.pair1[0], court.pair1[1], court.pair2[0], court.pair2[1]]
              return (
                <div key={court.court} className="rounded-xl bg-gray-50 border border-gray-200 p-3 flex flex-col gap-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{courtLabel(court.court)}</span>
                  {editMode ? (
                    <div className="flex items-stretch gap-2 text-sm">
                      <div className="flex-1 flex flex-col gap-1">
                        {[0, 1].map(k => <EditSlot key={k} p={slots[k]} selected={selectedSlot === base + k} onClick={() => tapSlot(base + k)} />)}
                      </div>
                      <span className="text-gray-400 font-semibold shrink-0 self-center">vs</span>
                      <div className="flex-1 flex flex-col gap-1">
                        {[2, 3].map(k => <EditSlot key={k} p={slots[k]} selected={selectedSlot === base + k} onClick={() => tapSlot(base + k)} />)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex-1"><PlayerChip p={court.pair1[0]} /> <span className="text-gray-400">&</span> <PlayerChip p={court.pair1[1]} /></div>
                      <span className="text-gray-400 font-semibold shrink-0">vs</span>
                      <div className="flex-1 text-right"><PlayerChip p={court.pair2[0]} /> <span className="text-gray-400">&</span> <PlayerChip p={court.pair2[1]} /></div>
                    </div>
                  )}
                  {!editMode && [court.pair1[0], court.pair1[1], court.pair2[0], court.pair2[1]].every(p => p.id) && (
                    <>
                      <button
                        onClick={() => setInsightCourt(insightCourt === court.court ? null : court.court)}
                        className="self-start text-gray-500 hover:text-gray-700 text-xs transition-colors"
                      >
                        {insightCourt === court.court ? '▾ Hide details' : '▸ Why these teams?'}
                      </button>
                      {insightCourt === court.court && (() => {
                        const nameOf = (id: string) => (players as Player[]).find(p => p.id === id)?.name ?? '…'
                        const tonight = (existingMatches as Match[]).filter(isScored)
                        const items = courtSeasonStats(
                          [court.pair1[0].id!, court.pair1[1].id!],
                          [court.pair2[0].id!, court.pair2[1].id!],
                          seasonMatches, tonight, nameOf,
                        )
                        return (
                          <div className="rounded-lg bg-white border border-gray-200 p-3 flex flex-col gap-2 text-xs">
                            <div>
                              <p className="text-gray-900 font-semibold">📊 Rotation check</p>
                              <p className="text-gray-500">{courtLabel(court.court)} — seeded from last week's finish (subs by season standing), paired best + worst for a balanced opener.</p>
                            </div>
                            {items.map((it, i) => (
                              <div key={i} className="flex gap-2">
                                <span className="shrink-0">{it.icon}</span>
                                <div className="min-w-0">
                                  <p className="text-gray-900 font-medium">{it.head}</p>
                                  <p className="text-gray-500">{it.sub}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {result.bench.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-amber-700 text-xs font-semibold">Sitting out game 1</p>
              <p className="text-amber-600 text-xs mt-1">
                {result.bench.map(p => p.name).join(', ')} — lowest-ranked, rotate them in next game.
              </p>
            </div>
          )}

          {result.unmatchedNames.length > 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
              <p className="text-gray-600 text-xs font-semibold">Guests</p>
              <p className="text-gray-500 text-xs mt-1">
                {result.unmatchedNames.join(', ')} — no league history, so they start at the bottom.
              </p>
            </div>
          )}

          {canApply && (
            <div className="flex flex-col gap-1 pt-1">
              <button
                onClick={applyToSession}
                disabled={applying}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
              >
                {applying
                  ? 'Creating games…'
                  : `Create Round 1 games (${applicableCourts.length} ${applicableCourts.length === 1 ? 'court' : 'courts'})`}
              </button>
              <p className="text-gray-500 text-xs text-center">
                Teams are set now — scores get entered on the session as each game finishes.
                {applicableCourts.length < result.courts.length && ' Courts with guests are skipped.'}
              </p>
              {applyError && <p className="text-red-600 text-xs text-center">{applyError}</p>}
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center">Select at least 4 players to see the courts.</p>
      )}

      {/* How it works */}
      <div className="text-gray-500 text-xs bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-1.5">
        <p><span className="text-gray-900 font-medium">How seeding works</span></p>
        <p>Players who were here <span className="text-gray-900">last week</span> keep that finishing order. Anyone subbed in is slotted by <span className="text-blue-600">season standing</span> (which reshuffles the courts); guests start at the bottom.</p>
        <p>Each court's pair is balanced — best + worst vs 2nd + 3rd — so the opening game is competitive.</p>
      </div>
    </div>
  )
}
