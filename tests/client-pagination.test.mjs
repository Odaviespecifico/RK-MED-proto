import test from 'node:test'
import assert from 'node:assert/strict'
import { clientPageBounds, clientPageSlice, nextAutoPage } from '../src/lib/useClientPage.ts'

test('clientPageBounds and clientPageSlice paginate lists and clamp out-of-range pages', () => {
  const empty = clientPageSlice([], 4, 3)
  assert.deepEqual(empty.items, [])
  assert.equal(empty.number, 1)
  assert.equal(empty.totalPages, 1)
  assert.equal(empty.start, 0)
  assert.equal(empty.end, 0)

  const items = Array.from({ length: 10 }, (_, index) => `p${index + 1}`)
  const first = clientPageSlice(items, 4, 1)
  assert.deepEqual(first.items, ['p1', 'p2', 'p3', 'p4'])
  assert.equal(first.totalPages, 3)
  assert.equal(first.start, 1)
  assert.equal(first.end, 4)

  const last = clientPageSlice(items, 4, 3)
  assert.deepEqual(last.items, ['p9', 'p10'])
  assert.equal(last.start, 9)
  assert.equal(last.end, 10)

  const clamped = clientPageBounds(10, 4, 99)
  assert.equal(clamped.number, 3)
  const clampedLow = clientPageBounds(10, 4, 0)
  assert.equal(clampedLow.number, 1)
})

test('nextAutoPage cycles through pages and wraps back to page 1', () => {
  assert.equal(nextAutoPage(1, 1), 1)
  assert.equal(nextAutoPage(1, 3), 2)
  assert.equal(nextAutoPage(2, 3), 3)
  assert.equal(nextAutoPage(3, 3), 1)
})
