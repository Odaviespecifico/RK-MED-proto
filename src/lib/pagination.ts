export type PageCursor = { at: string; id: string }
export type CursorPage<T> = { items: T[]; hasMore: boolean; nextCursor: PageCursor | null; savingsCents?: string | null }

export function mergeHistory<T extends { id: string; createdAt: string }>(saved: T[], fresh: T[]): T[] {
  const rows = new Map(saved.map(row => [row.id, row]))
  for (const row of fresh) rows.set(row.id, row)
  return [...rows.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
}
export function savedHistoryPage<T extends { id: string; createdAt: string }>(rows: T[], cursor: PageCursor | null, size = 25): CursorPage<T> {
  const ordered = mergeHistory([], rows)
  const start = cursor ? ordered.findIndex(row => row.id === cursor.id) + 1 : 0
  const items = ordered.slice(start, start + size)
  const hasMore = start + size < ordered.length
  const last = items.at(-1)
  return { items, hasMore, nextCursor: hasMore && last ? { id: last.id, at: last.createdAt } : null }
}
