// Playful names for courts, top-down. Court 1 (the top court) is the King's Court;
// lower courts descend through the deck. Beyond the named ones we fall back to a
// plain number so any court count works.
const COURT_NAMES = ["King's Court", "Queen's Court", "Jack's Court", "Ten's Court"]

export function courtName(court: number): string | null {
  return COURT_NAMES[court - 1] ?? null
}

// The court's display name — "King's Court" for named courts, else "Court 4".
// The number is dropped for named courts since the name already implies it.
export function courtLabel(court: number): string {
  return courtName(court) ?? `Court ${court}`
}
