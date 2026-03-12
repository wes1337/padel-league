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
