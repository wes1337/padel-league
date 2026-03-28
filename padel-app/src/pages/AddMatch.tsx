import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { usePlayers, useLeague, qk } from '../lib/queries'
import type { Player } from '../types'

// ── Bottom sheet player picker ────────────────────────────────────────────────
function PlayerPicker({
  open,
  label,
  selected,
  players,
  onSelect,
  onClose,
}: {
  open: boolean
  label: string
  selected: Player | null
  players: Player[]
  onSelect: (p: Player) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => searchRef.current?.focus(), 150)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet */}
      <div
        className="relative bg-gray-900 rounded-t-3xl flex flex-col"
        style={{ maxHeight: '80dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <p className="text-white font-semibold">{label}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <input
            ref={searchRef}
            type="text"
            className="w-full bg-gray-800 rounded-xl px-4 py-3 text-base text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Search player..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Player list */}
        <div className="overflow-y-auto flex flex-col px-4 pb-4 gap-1">
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">No players found</p>
          )}
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); onClose() }}
              className={`w-full text-left px-4 py-3.5 rounded-xl font-medium text-base transition-colors ${
                selected?.id === p.id
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-white'
              }`}
            >
              {p.name}
              {selected?.id === p.id && <span className="float-right text-green-300">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Slot button (replaces <select>) ──────────────────────────────────────────
function SlotButton({ player, label, onClick }: { player: Player | null; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-gray-700 rounded-xl px-3 py-3 text-base font-medium transition-colors active:bg-gray-600 ${
        player ? 'text-white' : 'text-red-400'
      }`}
    >
      {player ? player.name : label}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AddMatch() {
  const { leagueId, sessionId } = useParams<{ leagueId: string; sessionId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: players = [] } = usePlayers(leagueId)
  const { data: league } = useLeague(leagueId)
  const scoringType = league?.scoring_type ?? 'americano'

  const [slots, setSlots] = useState<(Player | null)[]>([null, null, null, null])
  const [team1Score, setTeam1Score] = useState('')
  const [team2Score, setTeam2Score] = useState('')
  const [activePicker, setActivePicker] = useState<number | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { window.scrollTo(0, 0) }, [sessionId])

  const allPlayers = players as Player[]
  const selectedIds = new Set(slots.filter(Boolean).map(p => p!.id))
  // Exclude already-selected players from the picker (except current slot's own selection)
  function availableFor(slotIdx: number) {
    return allPlayers.filter(p => !selectedIds.has(p.id) || slots[slotIdx]?.id === p.id)
  }

  function selectPlayer(slotIdx: number, player: Player) {
    const next = [...slots]
    next[slotIdx] = player
    setSlots(next)
  }

  async function handleAddPlayer() {
    const raw = newPlayerName.trim()
    if (!raw) return
    const name = raw.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    const existing = allPlayers.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setError(`"${existing.name}" already exists.`)
      setTimeout(() => setError(''), 2000)
      setNewPlayerName('')
      return
    }
    setAddingPlayer(true)
    const { data, error } = await supabase.from('players').insert({ league_id: leagueId, name }).select().single()
    if (data && !error) {
      queryClient.setQueryData(qk.players(leagueId!), (old: Player[] = []) =>
        [...old, data as Player].sort((a, b) => a.name.localeCompare(b.name))
      )
      setNewPlayerName('')
    }
    setAddingPlayer(false)
  }

  async function handleSave() {
    if (!league) { setError('League data not loaded yet.'); return }
    if (slots.some(p => !p)) { setError('Please select all 4 players.'); return }
    if (new Set(slots.map(p => p!.id)).size < 4) { setError('All 4 players must be different.'); return }
    const s1 = parseInt(team1Score)
    const s2 = parseInt(team2Score)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) { setError('Enter valid scores.'); return }
    setSaving(true)
    setError('')
    const { error } = await supabase.from('matches').insert({
      session_id: sessionId,
      scoring_type: scoringType,
      team1_p1: slots[0]!.id, team1_p2: slots[1]!.id,
      team2_p1: slots[2]!.id, team2_p2: slots[3]!.id,
      team1_score: s1, team2_score: s2,
    })
    if (error) { setError('Failed to save match.'); setSaving(false); return }
    queryClient.invalidateQueries({ queryKey: qk.sessionMatches(sessionId!) })
    navigate(-1)
  }

  const pickerLabels = ['Team 1 · Player 1', 'Team 1 · Player 2', 'Team 2 · Player 1', 'Team 2 · Player 2']

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-xl font-bold text-white">Add Match</h1>
      </div>

      {/* Players + Scores */}
      <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Team 1 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Team 1</span>
            <SlotButton player={slots[0]} label="Player 1" onClick={() => setActivePicker(0)} />
            <SlotButton player={slots[1]} label="Player 2" onClick={() => setActivePicker(1)} />
          </div>

          {/* Team 2 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Team 2</span>
            <SlotButton player={slots[2]} label="Player 3" onClick={() => setActivePicker(2)} />
            <SlotButton player={slots[3]} label="Player 4" onClick={() => setActivePicker(3)} />
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-blue-400">Team 1 score</span>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*"
              className="w-full bg-gray-700 rounded-lg px-2 py-3 text-white text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-blue-500"
              value={team1Score} onChange={e => setTeam1Score(e.target.value)} placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-purple-400">Team 2 score</span>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*"
              className="w-full bg-gray-700 rounded-lg px-2 py-3 text-white text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-purple-500"
              value={team2Score} onChange={e => setTeam2Score(e.target.value)} placeholder="0"
            />
          </div>
        </div>

        <p className="text-gray-500 text-xs text-center">
          {scoringType === 'americano' ? '🎯 Americano · points scored by each team' : '🎾 Traditional · games won by each team'}
        </p>
      </div>

      {/* Add new player */}
      <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-2">
        <p className="text-xs text-gray-400 font-medium">New player not in the list?</p>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-base text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-gray-500"
            placeholder="Player name"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddPlayer() }}
          />
          <button
            onClick={handleAddPlayer}
            disabled={addingPlayer || !newPlayerName.trim()}
            className="bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            {addingPlayer ? '...' : 'Add new player'}
          </button>
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

      <div className="text-center py-2">
        <p className="text-gray-500 text-sm">🎾 Powered by <Link to="/" className="text-green-400 hover:text-green-300 font-semibold transition-colors">Padello</Link></p>
        <Link to="/" className="text-gray-500 hover:text-white text-xs transition-colors">Start your own league →</Link>
      </div>

      {/* Player picker bottom sheet */}
      {activePicker !== null && (
        <PlayerPicker
          open={activePicker !== null}
          label={pickerLabels[activePicker]}
          selected={slots[activePicker]}
          players={availableFor(activePicker)}
          onSelect={p => selectPlayer(activePicker, p)}
          onClose={() => setActivePicker(null)}
        />
      )}
    </div>
  )
}
