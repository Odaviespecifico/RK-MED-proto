import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRevenueBars, buildStatusDonut, shortMonthLabel, wedeaProgress, wedeaStatusLabel } from '../src/lib/billing-metrics.ts'

test('shortMonthLabel formats YYYY-MM in pt-BR and falls back safely', () => {
  assert.equal(shortMonthLabel('2026-01'), 'Jan/26')
  assert.equal(shortMonthLabel('2026-11'), 'Nov/26')
  assert.equal(shortMonthLabel('invalid'), 'invalid')
})

test('buildRevenueBars normalizes stacked RKMED net and Wedea share percentages', () => {
  const bars = buildRevenueBars([
    { month: '2026-10', invoices: 2, grossCents: '13980', wedeaCents: '0', netCents: '13980' },
    { month: '2026-11', invoices: 4, grossCents: '27960', wedeaCents: '6348', netCents: '21612' },
  ])
  assert.equal(bars[0].label, 'Out/26')
  assert.equal(bars[0].grossPct, 50)
  assert.equal(bars[0].wedeaPct, 0)
  assert.equal(bars[0].netPct, 50)
  assert.equal(bars[1].grossPct, 100)
  assert.equal(Math.round(bars[1].netPct + bars[1].wedeaPct), 100)
})

test('buildStatusDonut computes totals and percentages accurately', () => {
  const donut = buildStatusDonut({ active: 8, canceling: 2, pastDue: 5, canceled: 3, incomplete: 2, blocked: 1 })
  assert.equal(donut.total, 20)
  assert.equal(donut.segments.find(segment => segment.key === 'active')?.percent, 40)
  assert.equal(donut.segments.find(segment => segment.key === 'pastDue')?.percent, 25)
})

test('wedeaProgress enforces the >200 active paying members threshold (D27)', () => {
  const below = wedeaProgress(200, 200)
  assert.equal(below.eligible, false)
  assert.equal(below.remaining, 1)

  const above = wedeaProgress(201, 200)
  assert.equal(above.eligible, true)
  assert.equal(above.remaining, 0)
  assert.equal(above.percent, 100)

  assert.equal(wedeaStatusLabel('sent'), 'Repasse enviado')
  assert.equal(wedeaStatusLabel('skipped'), 'Abaixo da faixa (≤ 200)')
})
