import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { League, Session, Match, Player } from '../types'

// Centralised cache keys — import these when invalidating after mutations
export const qk = {
  league:        (id: string)       => ['league', id] as const,
  sessions:      (leagueId: string) => ['sessions', leagueId] as const,
  session:       (id: string)       => ['session', id] as const,
  players:       (leagueId: string) => ['players', leagueId] as const,
  sessionMatches:(sessionId: string)=> ['matches', sessionId] as const,
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
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}

export function useSessions(leagueId: string | undefined) {
  return useQuery({
    queryKey: qk.sessions(leagueId ?? ''),
    queryFn: async () => {
      const { data } = await supabase.from('sessions').select('*').eq('league_id', leagueId!).order('date', { ascending: false })
      return (data ?? []) as Session[]
    },
    enabled: !!leagueId,
    staleTime: 30 * 1000,
  })
}

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: qk.session(sessionId ?? ''),
    queryFn: async () => {
      const { data } = await supabase.from('sessions').select('*').eq('id', sessionId!).single()
      return data as Session | null
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  })
}

export function usePlayers(leagueId: string | undefined) {
  return useQuery({
    queryKey: qk.players(leagueId ?? ''),
    queryFn: async () => {
      const { data } = await supabase.from('players').select('*').eq('league_id', leagueId!).order('name')
      return (data ?? []) as Player[]
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSessionMatches(sessionId: string | undefined) {
  return useQuery({
    queryKey: qk.sessionMatches(sessionId ?? ''),
    queryFn: async () => {
      const { data } = await supabase.from('matches').select('*').eq('session_id', sessionId!).order('created_at')
      return (data ?? []) as Match[]
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  })
}

// Fetches matches across multiple sessions — cache key includes the session IDs so it
// refetches automatically when the session list changes (e.g. new session added).
export function useMultiSessionMatches(sessionIds: string[], cacheScope: string) {
  return useQuery({
    queryKey: ['matches', 'multi', cacheScope, sessionIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase.from('matches').select('*').in('session_id', sessionIds)
      return (data ?? []) as Match[]
    },
    enabled: sessionIds.length > 0,
    staleTime: 30 * 1000,
  })
}
