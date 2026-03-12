export function isLeagueAdmin(leagueId: string): boolean {
  const admins: string[] = JSON.parse(localStorage.getItem('admin_leagues') || '[]')
  return admins.includes(leagueId)
}

export function saveLeagueAdmin(leagueId: string): void {
  const admins: string[] = JSON.parse(localStorage.getItem('admin_leagues') || '[]')
  if (!admins.includes(leagueId)) {
    admins.push(leagueId)
    localStorage.setItem('admin_leagues', JSON.stringify(admins))
  }
}

export function saveSessionCreator(sessionId: string, token: string): void {
  const map: Record<string, string> = JSON.parse(localStorage.getItem('session_creator_tokens') || '{}')
  map[sessionId] = token
  localStorage.setItem('session_creator_tokens', JSON.stringify(map))
}

export function isSessionCreator(sessionId: string, creatorToken: string | null | undefined): boolean {
  if (!creatorToken) return false
  const map: Record<string, string> = JSON.parse(localStorage.getItem('session_creator_tokens') || '{}')
  return map[sessionId] === creatorToken
}
