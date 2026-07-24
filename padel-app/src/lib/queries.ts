import { useEffect } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { League, Season, Session, Match, Player, SessionSignup } from '../types'

// Subscribe to live match changes so any screen showing match-derived data
// (scores, standings, round pairings) refreshes within a second when another
// device creates, scores, or deletes a game — no manual refresh. Requires the
// `matches` table to be in the supabase_realtime publication (see the migration).
// `scope` just keeps each page's channel name distinct.
export function useRealtimeMatches(scope: string) {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel(`matches-sync-${scope}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' },
        () => qc.invalidateQueries({ queryKey: ['matches'] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [scope, qc])
}

// Centralised cache keys — import these when invalidating after mutations
export const qk = {
  league:        (id: string)       => ['league', id] as const,
  seasons:       (leagueId: string) => ['seasons', leagueId] as const,
  sessions:      (leagueId: string) => ['sessions', leagueId] as const,
  session:       (id: string)       => ['session', id] as const,
  players:       (leagueId: string) => ['players', leagueId] as const,
  sessionMatches:(sessionId: string)=> ['matches', sessionId] as const,
  sessionSignups:(sessionId: string)=> ['session_signups', sessionId] as const,
}

export function useLeague(leagueId: string | undefined) {
  return useQuery({
    queryKey: qk.league(leagueId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.from('leagues').select('*').eq('id', leagueId!).single()
      if (error) throw error
      return data as League | null
    },
    enabled: !!leagueId,
    retry: 2,
  })
}

export function useSeasons(leagueId: string | undefined) {
  return useQuery({
    queryKey: qk.seasons(leagueId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.from('seasons').select('*').eq('league_id', leagueId!).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Season[]
    },
    enabled: !!leagueId,
  })
}

export function useSessions(leagueId: string | undefined) {
  return useQuery({
    queryKey: qk.sessions(leagueId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('league_id', leagueId!).order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Session[]
    },
    enabled: !!leagueId,
  })
}

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: qk.session(sessionId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId!).single()
      if (error) throw error
      return data as Session | null
    },
    enabled: !!sessionId,
  })
}

export function usePlayers(leagueId: string | undefined) {
  return useQuery({
    queryKey: qk.players(leagueId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.from('players').select('*').eq('league_id', leagueId!).order('name')
      if (error) throw error
      return (data ?? []) as Player[]
    },
    enabled: !!leagueId,
  })
}

export function useSessionMatches(sessionId: string | undefined) {
  return useQuery({
    queryKey: qk.sessionMatches(sessionId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('*').eq('session_id', sessionId!).order('created_at')
      if (error) throw error
      return (data ?? []) as Match[]
    },
    enabled: !!sessionId,
    // Safety net for live scoring: realtime pushes updates instantly, but a phone
    // that's just watching can miss an event if its socket drops (screen off,
    // backgrounded, network blip) — and realtime never replays missed events. Poll
    // every 15s so a passive phone self-corrects within seconds instead of getting
    // stuck on a stale "awaiting" state. Only runs while the tab is visible (the
    // default), so it doesn't drain the battery in the background.
    refetchInterval: 15000,
  })
}

export function useSessionSignups(sessionId: string | undefined) {
  return useQuery({
    queryKey: qk.sessionSignups(sessionId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.from('session_signups').select('*').eq('session_id', sessionId!).order('created_at')
      if (error) throw error
      return (data ?? []) as SessionSignup[]
    },
    enabled: !!sessionId,
  })
}

export function useSignupCounts(sessionIds: string[]) {
  return useQuery({
    queryKey: ['signup_counts', sessionIds.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase.from('session_signups').select('session_id').in('session_id', sessionIds)
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        counts[row.session_id] = (counts[row.session_id] ?? 0) + 1
      }
      return counts
    },
    enabled: sessionIds.length > 0,
  })
}

// Prefetch all league data in parallel — call on hover/touch before navigating
export function prefetchLeagueData(qc: QueryClient, leagueId: string) {
  qc.prefetchQuery({
    queryKey: qk.league(leagueId),
    queryFn: async () => {
      const { data, error } = await supabase.from('leagues').select('*').eq('id', leagueId).single()
      if (error) throw error
      return data as League | null
    },
  })
  qc.prefetchQuery({
    queryKey: qk.seasons(leagueId),
    queryFn: async () => {
      const { data, error } = await supabase.from('seasons').select('*').eq('league_id', leagueId).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Season[]
    },
  })
  qc.prefetchQuery({
    queryKey: qk.sessions(leagueId),
    queryFn: async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('league_id', leagueId).order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Session[]
    },
  })
  qc.prefetchQuery({
    queryKey: qk.players(leagueId),
    queryFn: async () => {
      const { data, error } = await supabase.from('players').select('*').eq('league_id', leagueId).order('name')
      if (error) throw error
      return (data ?? []) as Player[]
    },
  })
}

// Fetches matches across multiple sessions — cache key includes the session IDs so it
// refetches automatically when the session list changes (e.g. new session added).
export function useMultiSessionMatches(sessionIds: string[], cacheScope: string) {
  return useQuery({
    queryKey: ['matches', 'multi', cacheScope, sessionIds.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('*').in('session_id', sessionIds)
      if (error) throw error
      return (data ?? []) as Match[]
    },
    enabled: sessionIds.length > 0,
  })
}
