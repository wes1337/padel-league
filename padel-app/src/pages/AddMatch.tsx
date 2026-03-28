import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { usePlayers, useLeague, qk } from '../lib/queries'
import type { Player } from '../types'

const TEAM_COLORS = {
  label:  ['text-blue-400',   'text-purple-400'],
  ring:   ['focus:ring-blue-500', 'focus:ring-purple-500'],
  bg:     ['bg-blue-600',     'bg-purple-600'],
  bgDim:  ['bg-blue-900/50',  'bg-purple-900/50'],
  border: ['border-blue-500', 'border-purple-500'],
}

function teamOf(slotIdx: number) { return slotIdx < 2 ? 0 : 1 }

// ── Bottom sheet picker ───────────────────────────────────────────────────────
function PlayerPicker({
  open,
  activeSlot,
  slots,
  players,
  onSlotsChange,
  onClose,
  onAddPlayer,
}: {
  open: boolean
  activeSlot: number
  slots: (Player | null)[]
  players: Player[]
  onSlotsChange: (s: (Player | null)[]) => void
  onClose: () => void
  onAddPlayer: (name: string, assignToSlot: number) => Promise<Player | null>
}) {
  const [currentSlot, setCurrentSlot] = useState(activeSlot)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Reset when opened
  useEffect(() => {
    if (open) {
      setCurrentSlot(activeSlot)
      setSearch('')
      setTimeout(() => searchRef.current?.focus(), 150)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open, activeSlot])

  if (!open) return null

  function nextEmpty(s: (Player | null)[], from: number): number {
    // Look for empty slot starting from 'from', wrap around
    for (let i = 1; i <= 4; i++) {
      const idx = (from + i) % 4
      if (!s[idx]) return idx
    }
    return from // all full — stay
  }

  function handleTap(player: Player) {
    const existingSlot = slots.findIndex(s => s?.id === player.id)
    const next = [...slots]

    if (existingSlot !== -1) {
      // Toggle off — free the slot and move cursor there
      next[existingSlot] = null
      onSlotsChange(next)
      setCurrentSlot(existingSlot)
    } else {
      // Assign to current slot
      next[currentSlot] = player
      onSlotsChange(next)
      // Advance to next empty slot
      const allFull = next.every(Boolean)
      if (!allFull) setCurrentSlot(nextEmpty(next, currentSlot))
    }
  }

  async function handleQuickAdd() {
    const name = search.trim()
    if (!name || adding) return
    setAdding(true)
    const player = await onAddPlayer(name, currentSlot)
    if (player) {
      const next = [...slots]
      next[currentSlot] = player
      onSlotsChange(next)
      setSearch('')
      const allFull = next.every(Boolean)
      if (!allFull) setCurrentSlot(nextEmpty(next, currentSlot))
    }
    setAdding(false)
  }

  const slotLabels = ['Team 1 · P1', 'Team 1 · P2', 'Team 2 · P1', 'Team 2 · P2']
  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-gray-900 rounded-t-3xl flex flex-col"
        style={{ maxHeight: '85dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>

        {/* Slot tabs — Team 1 left column, Team 2 right column */}
        <div className="px-4 pt-2 pb-3 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {/* Team 1 column */}
            <div className="flex flex-col gap-2">
              {[0, 1].map(i => {
                const isActive = i === currentSlot
                const filled = slots[i]
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentSlot(i)}
                    className={`rounded-xl px-3 py-2 text-left transition-all border ${
                      isActive
                        ? `${filled ? TEAM_COLORS.bgDim[0] : 'bg-gray-800'} ${TEAM_COLORS.border[0]}`
                        : `${filled ? TEAM_COLORS.bgDim[0] : 'bg-gray-800'} border-transparent`
                    }`}
                  >
                    <p className={`text-xs font-semibold ${TEAM_COLORS.label[0]}`}>{slotLabels[i]}</p>
                    <p className={`text-sm font-medium truncate ${filled ? 'text-white' : 'text-gray-500'}`}>
                      {filled ? filled.name : 'Not set'}
                    </p>
                  </button>
                )
              })}
            </div>
            {/* Team 2 column */}
            <div className="flex flex-col gap-2">
              {[2, 3].map(i => {
                const isActive = i === currentSlot
                const filled = slots[i]
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentSlot(i)}
                    className={`rounded-xl px-3 py-2 text-left transition-all border ${
                      isActive
                        ? `${filled ? TEAM_COLORS.bgDim[1] : 'bg-gray-800'} ${TEAM_COLORS.border[1]}`
                        : `${filled ? TEAM_COLORS.bgDim[1] : 'bg-gray-800'} border-transparent`
                    }`}
                  >
                    <p className={`text-xs font-semibold ${TEAM_COLORS.label[1]}`}>{slotLabels[i]}</p>
                    <p className={`text-sm font-medium truncate ${filled ? 'text-white' : 'text-gray-500'}`}>
                      {filled ? filled.name : 'Not set'}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Player list — above the search so keyboard doesn't cover results */}
        <div className="overflow-y-auto flex flex-col px-4 pb-4 gap-1.5">
          {filtered.length === 0 && !search.trim() && (
            <p className="text-gray-500 text-sm text-center py-6">No players found</p>
          )}
          {filtered.map(p => {
            const assignedSlot = slots.findIndex(s => s?.id === p.id)
            const isAssigned = assignedSlot !== -1
            const assignedTeam = isAssigned ? teamOf(assignedSlot) : null

            return (
              <button
                key={p.id}
                onClick={() => handleTap(p)}
                className={`w-full text-left px-4 py-3.5 rounded-xl font-medium text-base transition-colors flex items-center justify-between ${
                  isAssigned
                    ? `${TEAM_COLORS.bg[assignedTeam!]} text-white`
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
              >
                <span>{p.name}</span>
                {isAssigned && (
                  <span className="text-xs opacity-80 shrink-0 ml-2">
                    {slotLabels[assignedSlot]} ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search + Done — pinned at bottom so keyboard pushes list up, not results down */}
        <div className="px-4 pb-4 pt-2 shrink-0 border-t border-gray-800 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={searchRef}
              type="text"
              className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-base text-white placeholder-yellow-700 outline-none border border-yellow-500/40 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
              placeholder="Search / Add New Player"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search.trim() && filtered.length === 0 && (
              <button
                onClick={handleQuickAdd}
                disabled={adding}
                className="shrink-0 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-900 font-semibold text-sm px-3 py-3 rounded-xl transition-colors"
              >
                {adding ? '...' : 'Add +'}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className={`w-full font-semibold rounded-xl py-3 transition-colors ${
              slots.every(Boolean)
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Slot button ───────────────────────────────────────────────────────────────
function SlotButton({ player, label, teamIdx, onClick }: {
  player: Player | null; label: string; teamIdx: number; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl px-3 py-3 text-base font-medium transition-colors active:opacity-70 ${
        player
          ? `${TEAM_COLORS.bgDim[teamIdx]} ${TEAM_COLORS.label[teamIdx]} border ${TEAM_COLORS.border[teamIdx]}`
          : 'bg-gray-700 text-red-400 border border-transparent'
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeSlot, setActiveSlot] = useState(0)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { window.scrollTo(0, 0) }, [sessionId])

  function openPicker(slot: number) {
    setActiveSlot(slot)
    setPickerOpen(true)
  }

  const allPlayers = players as Player[]

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
      setShowAddInput(false)
    }
    setAddingPlayer(false)
  }

  async function createPlayer(raw: string): Promise<Player | null> {
    const name = raw.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    const existing = allPlayers.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing
    const { data, error } = await supabase.from('players').insert({ league_id: leagueId, name }).select().single()
    if (data && !error) {
      queryClient.setQueryData(qk.players(leagueId!), (old: Player[] = []) =>
        [...old, data as Player].sort((a, b) => a.name.localeCompare(b.name))
      )
      return data as Player
    }
    return null
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

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-xl font-bold text-white">Add Match</h1>
      </div>

      {/* Players + Scores */}
      <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Team 1</span>
            <SlotButton player={slots[0]} label="Player 1" teamIdx={0} onClick={() => openPicker(0)} />
            <SlotButton player={slots[1]} label="Player 2" teamIdx={0} onClick={() => openPicker(1)} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Team 2</span>
            <SlotButton player={slots[2]} label="Player 3" teamIdx={1} onClick={() => openPicker(2)} />
            <SlotButton player={slots[3]} label="Player 4" teamIdx={1} onClick={() => openPicker(3)} />
          </div>
        </div>

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
      {showAddInput ? (
        <div className="bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-2">
          <input
            ref={addInputRef}
            type="text"
            autoFocus
            className="flex-1 bg-gray-700 rounded-lg px-3 py-2.5 text-base text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-yellow-500"
            placeholder="Player name"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddPlayer()
              if (e.key === 'Escape') { setShowAddInput(false); setNewPlayerName('') }
            }}
            onBlur={() => { if (!newPlayerName.trim()) { setShowAddInput(false) } }}
          />
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={handleAddPlayer}
            disabled={addingPlayer || !newPlayerName.trim()}
            className={`shrink-0 disabled:opacity-40 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors ${
              newPlayerName.trim()
                ? 'bg-yellow-400 hover:bg-yellow-300 text-gray-900'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {addingPlayer ? '...' : 'Add'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddInput(true)}
          className="w-full bg-transparent border border-yellow-500 text-yellow-500 text-sm font-semibold py-3 rounded-2xl transition-colors hover:bg-yellow-500/10"
        >
          + Add new player
        </button>
      )}

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

      <PlayerPicker
        open={pickerOpen}
        activeSlot={activeSlot}
        slots={slots}
        players={allPlayers}
        onSlotsChange={setSlots}
        onClose={() => setPickerOpen(false)}
        onAddPlayer={createPlayer}
      />
    </div>
  )
}
