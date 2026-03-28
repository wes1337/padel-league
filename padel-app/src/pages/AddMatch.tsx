import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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

  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [p3, setP3] = useState('')
  const [p4, setP4] = useState('')
  const [team1Score, setTeam1Score] = useState('')
  const [team2Score, setTeam2Score] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { window.scrollTo(0, 0) }, [sessionId])

  async function handleAddPlayer() {
    const raw = newPlayerName.trim()
    if (!raw) return
    const name = raw.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    const existing = (players as Player[]).find(p => p.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setError(`"${existing.name}" already exists.`)
      setTimeout(() => setError(''), 2000)
      setNewPlayerName('')
      return
    }
    setAddingPlayer(true)
    const { data, error } = await supabase.from('players').insert({ league_id: leagueId, name }).select().single()
    if (data && !error) {
      // Optimistically update cache so player appears immediately without waiting for refetch
      queryClient.setQueryData(qk.players(leagueId!), (old: Player[] = []) =>
        [...old, data as Player].sort((a, b) => a.name.localeCompare(b.name))
      )
      setNewPlayerName('')
    }
    setAddingPlayer(false)
  }

  async function handleSave() {
    if (!league) { setError('League data not loaded yet.'); return }
    if (!p1 || !p2 || !p3 || !p4) { setError('Please select all 4 players.'); return }
    if (new Set([p1, p2, p3, p4]).size < 4) { setError('All 4 players must be different.'); return }
    const s1 = parseInt(team1Score)
    const s2 = parseInt(team2Score)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) { setError('Enter valid scores.'); return }
    setSaving(true)
    setError('')
    const { error } = await supabase.from('matches').insert({
      session_id: sessionId,
      scoring_type: scoringType,
      team1_p1: p1, team1_p2: p2,
      team2_p1: p3, team2_p2: p4,
      team1_score: s1, team2_score: s2,
    })
    if (error) { setError('Failed to save match.'); setSaving(false); return }
    queryClient.invalidateQueries({ queryKey: qk.sessionMatches(sessionId!) })
    navigate(-1)
  }

  const allPlayers: Player[] = players as Player[]

  // Select class — red text when no player chosen (makes placeholder obvious), white when chosen
  const selectCls = (val: string) =>
    `w-full bg-gray-700 rounded-lg px-3 py-3 text-base outline-none ${val ? 'text-white' : 'text-red-400'}`

  return (
    <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-xl font-bold text-white">Add Match</h1>
      </div>

      {/* Players + Scores */}
      <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">

        {/* Team headers + player dropdowns */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Team 1</span>
            <select value={p1} onChange={e => setP1(e.target.value)} className={selectCls(p1)}>
              <option value="">Player 1</option>
              {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={p2} onChange={e => setP2(e.target.value)} className={selectCls(p2)}>
              <option value="">Player 2</option>
              {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Team 2</span>
            <select value={p3} onChange={e => setP3(e.target.value)} className={selectCls(p3)}>
              <option value="">Player 3</option>
              {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={p4} onChange={e => setP4(e.target.value)} className={selectCls(p4)}>
              <option value="">Player 4</option>
              {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Score row — aligned under each team */}
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

      {/* Add new player — text-base (16px) prevents iOS zoom */}
      <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-2">
        <p className="text-xs text-gray-400 font-medium">New player not in the list?</p>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-base text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Type full name..."
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddPlayer() }}
          />
          <button
            onClick={handleAddPlayer}
            disabled={addingPlayer || !newPlayerName.trim()}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            {addingPlayer ? '...' : '+ Add'}
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
    </div>
  )
}
