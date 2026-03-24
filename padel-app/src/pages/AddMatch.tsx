import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { usePlayers, useLeague, qk } from '../lib/queries'
import type { Player } from '../types'

export default function AddMatch() {
  const { leagueId, sessionId } = useParams<{ leagueId: string; sessionId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: players = [] } = usePlayers(leagueId)
  const { data: league } = useLeague(leagueId)
  const scoringType = league?.scoring_type ?? 'americano'

  const [selected, setSelected] = useState<(Player | null)[]>([null, null, null, null])
  const [team1Score, setTeam1Score] = useState('')
  const [team2Score, setTeam2Score] = useState('')
  const [activeTeam, setActiveTeam] = useState<number | null>(null)
  const [pickingPlayer, setPickingPlayer] = useState(0)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Lock body scroll and focus search when picker opens
  useEffect(() => {
    if (activeTeam !== null) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => searchRef.current?.focus(), 100)
      return () => { document.body.style.overflow = '' }
    }
  }, [activeTeam])

  function openTeam(team: number) {
    const base = team * 2
    // Start at first empty slot, or P1 if both filled
    const start = !selected[base] ? 0 : !selected[base + 1] ? 1 : 0
    setActiveTeam(team)
    setPickingPlayer(start)
  }

  const selectedIds = selected.filter(Boolean).map(p => p!.id)

  const filteredPlayers = players.filter(p =>
    !selectedIds.includes(p.id) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  async function addNewPlayer() {
    const raw = search.trim()
    if (!raw) return
    const name = raw.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    const existing = players.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setError(`"${existing.name}" already exists — selected them.`)
      setTimeout(() => setError(''), 2000)
      selectPlayer(existing)
      return
    }
    const { data, error } = await supabase
      .from('players')
      .insert({ league_id: leagueId, name })
      .select()
      .single()
    if (data && !error) {
      queryClient.invalidateQueries({ queryKey: qk.players(leagueId!) })
      selectPlayer(data as Player)
    }
  }

  function selectPlayer(player: Player) {
    if (activeTeam === null) return
    const slot = activeTeam * 2 + pickingPlayer
    const next = [...selected]
    next[slot] = player
    setSelected(next)
    if (pickingPlayer === 0) {
      // Advance to P2
      setPickingPlayer(1)
      setSearch('')
    } else {
      // Both picked — close modal
      setActiveTeam(null)
      setSearch('')
    }
  }

  function clearSlot(idx: number, e: React.MouseEvent) {
    e.stopPropagation()
    const next = [...selected]
    next[idx] = null
    setSelected(next)
  }

  async function handleSave() {
    if (!league) { setError('League data not loaded yet.'); return }
    if (selected.some(p => !p)) { setError('Please fill all 4 player slots.'); return }
    const s1 = parseInt(team1Score)
    const s2 = parseInt(team2Score)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) { setError('Enter valid scores.'); return }
    setSaving(true)
    setError('')
    const { error } = await supabase.from('matches').insert({
      session_id: sessionId,
      scoring_type: scoringType,
      team1_p1: selected[0]!.id,
      team1_p2: selected[1]!.id,
      team2_p1: selected[2]!.id,
      team2_p2: selected[3]!.id,
      team1_score: s1,
      team2_score: s2,
    })
    if (error) { setError('Failed to save match.'); setSaving(false); return }
    queryClient.invalidateQueries({ queryKey: qk.sessionMatches(sessionId!) })
    navigate(-1)
  }

  const teamConfig = [
    { label: 'Team 1', color: 'blue', base: 0, ring: 'ring-blue-400', border: 'border-blue-800', bg: 'bg-blue-900/20', textColor: 'text-blue-400' },
    { label: 'Team 2', color: 'purple', base: 2, ring: 'ring-purple-400', border: 'border-purple-800', bg: 'bg-purple-900/20', textColor: 'text-purple-400' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-xl font-bold text-white">Add Match</h1>
      </div>

      {/* Player Slots */}
      <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-4">
        <h2 className="font-semibold text-white">Players</h2>
        <div className="grid grid-cols-2 gap-3">
          {teamConfig.map((team, t) => (
            <div
              key={t}
              onClick={() => openTeam(t)}
              className={`${team.bg} border ${team.border} rounded-xl p-3 flex flex-col gap-2 cursor-pointer transition-all hover:opacity-90 ${activeTeam === t ? `ring-2 ${team.ring}` : ''}`}
            >
              <span className={`text-xs font-semibold uppercase tracking-wide ${team.textColor}`}>{team.label}</span>
              {[0, 1].map(p => {
                const idx = team.base + p
                return selected[idx] ? (
                  <div key={p} className="flex items-center justify-between bg-black/20 rounded-lg px-2 py-1.5">
                    <span className="text-white font-semibold text-sm truncate">{selected[idx]!.name}</span>
                    <button onClick={e => clearSlot(idx, e)} className="text-gray-500 hover:text-red-400 text-xs ml-1 shrink-0">✕</button>
                  </div>
                ) : (
                  <div key={p} className="flex items-center bg-black/10 rounded-lg px-2 py-1.5">
                    <span className="text-gray-500 text-sm">Player {p + 1}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Player Picker Modal */}
      {activeTeam !== null && (
        <div className="fixed inset-0 bg-black/80 flex flex-col z-50" onClick={() => setActiveTeam(null)}>
          <div className="flex-1" />
          <div className="w-full bg-gray-900 rounded-t-3xl p-5 flex flex-col gap-4 h-[100dvh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">{teamConfig[activeTeam].label}</h3>
                {pickingPlayer === 1 && selected[activeTeam * 2] ? (
                  <p className="text-sm text-gray-400">
                    <span className={`font-semibold ${teamConfig[activeTeam].textColor}`}>{selected[activeTeam * 2]!.name}</span> & <span className="italic">picking partner…</span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">Pick first player</p>
                )}
              </div>
              <button onClick={() => setActiveTeam(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            {/* Combined search / add input */}
            <input
              ref={searchRef}
              className="bg-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Search or type new name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && search.trim() && filteredPlayers.length === 0) addNewPlayer()
              }}
            />

            {/* Player list */}
            <div className="overflow-y-auto flex flex-col gap-2">
              {/* Add new option — shown when typed name doesn't match any existing player */}
              {search.trim() && !players.some(p => p.name.toLowerCase() === search.trim().toLowerCase()) && (
                <button
                  onClick={addNewPlayer}
                  className="w-full text-left bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800 rounded-xl px-4 py-3 text-blue-300 font-medium transition-colors"
                >
                  + Add "{search.trim()}"
                </button>
              )}
              {filteredPlayers.length === 0 && !search.trim() && (
                <p className="text-gray-500 text-sm text-center py-2">No players yet — type a name to add one.</p>
              )}
              {filteredPlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPlayer(p)}
                  className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 text-white font-medium transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Score */}
      <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Score</h2>
          <span className="text-xs text-gray-500">{scoringType === 'americano' ? '🎯 Americano' : '🎾 Traditional'}</span>
        </div>
        <p className="text-gray-500 text-xs -mt-1">
          {scoringType === 'americano' ? 'Points scored by each team (e.g. 17 – 15)' : 'Games won by each team (e.g. 6 – 4)'}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <label className="text-xs text-blue-400">Team 1</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-full bg-gray-800 rounded-lg px-2 py-3 text-white text-xl font-bold text-center outline-none focus:ring-2 focus:ring-blue-500"
              value={team1Score}
              onChange={e => setTeam1Score(e.target.value)}
              placeholder="0"
            />
          </div>
          <span className="text-gray-500 text-2xl font-bold mt-4 shrink-0">–</span>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <label className="text-xs text-purple-400">Team 2</label>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              className="w-full bg-gray-800 rounded-lg px-2 py-3 text-white text-xl font-bold text-center outline-none focus:ring-2 focus:ring-purple-500"
              value={team2Score}
              onChange={e => setTeam2Score(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl py-4 text-lg transition-colors"
      >
        {saving ? 'Saving...' : 'Save Match'}
      </button>
    </div>
  )
}
