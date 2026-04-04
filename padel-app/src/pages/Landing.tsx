import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { nanoid } from 'nanoid'
import { saveLeagueAdmin } from '../lib/admin'
import { prefetchLeagueData } from '../lib/queries'
import type { ScoringType } from '../types'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function Landing() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [leagueName, setLeagueName] = useState('')
  const [scoringType, setScoringType] = useState<ScoringType>('americano')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const recentLeagues: { id: string; name: string }[] = JSON.parse(localStorage.getItem('recent_leagues') || '[]')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSInstall, setShowIOSInstall] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(() => sessionStorage.getItem('install_dismissed') === '1')

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone)
    if (isStandalone) return

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      setShowIOSInstall(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }

  function dismissInstallBanner() {
    setInstallDismissed(true)
    setInstallPrompt(null)
    setShowIOSInstall(false)
    sessionStorage.setItem('install_dismissed', '1')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!leagueName.trim()) return
    setCreating(true)
    setError('')
    const { data: existing } = await supabase
      .from('leagues')
      .select('id')
      .ilike('name', leagueName.trim())
      .maybeSingle()
    if (existing) {
      setError('A league with that name already exists.')
      setCreating(false)
      return
    }
    const id = nanoid(8)
    const admin_token = nanoid(8)
    const { error } = await supabase.from('leagues').insert({ id, name: leagueName.trim(), admin_token, scoring_type: scoringType })
    if (error) {
      console.error('Supabase error:', error)
      setError(`Error: ${error.message}`)
      setCreating(false)
      return
    }
    saveLeagueAdmin(id)
    navigate(`/l/${id}`)
  }


  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-10">
      <div className="text-center">
        <div className="text-5xl mb-2">🎾</div>
        <h1 className="text-3xl font-bold text-gray-900">Padello</h1>
        <p className="text-gray-500 mt-1">Track scores. Crown champions.</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Install app banner */}
        {!installDismissed && installPrompt && (
          <div className="bg-green-50 border border-green-300 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Install as App</h2>
              <button onClick={dismissInstallBanner} className="text-gray-500 hover:text-gray-700 text-xs">dismiss</button>
            </div>
            <p className="text-gray-900 text-xs">Add <span className="text-green-600 font-medium">Padello</span> to your home screen for quick access — works like a native app.</p>
            <button
              onClick={handleInstall}
              className="bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
            >
              Install App
            </button>
          </div>
        )}

        {!installDismissed && showIOSInstall && (
          <div className="bg-green-50 border border-green-300 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Install as App</h2>
              <button onClick={dismissInstallBanner} className="text-gray-500 hover:text-gray-700 text-xs">dismiss</button>
            </div>
            <p className="text-gray-900 text-xs">
              Tap the <span className="text-green-600 font-medium">share button</span>, then <span className="text-green-600 font-medium">"Add to Home Screen"</span> to install.
            </p>
          </div>
        )}

        {/* Recent leagues */}
        {recentLeagues.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
            <h2 className="font-semibold text-gray-900 text-lg">Recent Leagues</h2>
            {recentLeagues.map(l => (
              <button
                key={l.id}
                onClick={() => navigate(`/l/${l.id}`)}
                onMouseEnter={() => prefetchLeagueData(queryClient, l.id)}
                onTouchStart={() => prefetchLeagueData(queryClient, l.id)}
                className="flex items-center justify-between bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 transition-colors"
              >
                <span className="text-gray-900 font-medium">{l.name}</span>
                <span className="text-gray-500 text-sm">→</span>
              </button>
            ))}
          </div>
        )}

        {/* Create league */}
        <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-900 text-lg">Create a League</h2>
          <input
            className="bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500"
            placeholder="League name (e.g. Friday Padel)"
            value={leagueName}
            maxLength={50}
            onChange={e => setLeagueName(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <p className="text-gray-500 text-xs">Scoring format</p>
            <div className="flex gap-2">
              {(['americano', 'traditional'] as ScoringType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setScoringType(type)}
                  className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-colors capitalize ${
                    scoringType === type ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {type === 'americano' ? '🎯 Americano' : '🎾 Traditional'}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !leagueName.trim()}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors"
          >
            {creating ? 'Creating...' : 'Create League'}
          </button>
        </form>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
      </div>
    </div>
  )
}
