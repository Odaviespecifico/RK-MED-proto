import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeHistory, savedHistoryPage } from '../../src/lib/pagination.ts'

test('RF-QR: saving a new history page preserves older downloaded rows and updates reversals', () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ id: String(i).padStart(3, '0'), createdAt: '2026-01-01T00:00:00Z', reversedAt: null }))
  const merged = mergeHistory(rows, [{ ...rows[0], reversedAt: '2026-01-02T00:00:00Z' }])
  assert.equal(merged.length, 60)
  assert.equal(merged.find(row => row.id === '000').reversedAt, '2026-01-02T00:00:00Z')
  const first = savedHistoryPage(merged, null)
  const second = savedHistoryPage(merged, first.nextCursor)
  const last = savedHistoryPage(merged, second.nextCursor)
  assert.equal(first.items.length, 25); assert.equal(second.items.length, 25); assert.equal(last.items.length, 10)
  assert.equal(new Set([...first.items, ...second.items, ...last.items].map(row => row.id)).size, 60)
  assert.equal(last.hasMore, false); assert.equal(last.nextCursor, null)
})
