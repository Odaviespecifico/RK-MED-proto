import test from 'node:test'
import assert from 'node:assert/strict'
import { activeWorkAssignment, calculateDiscount, isEligible, memberSavings } from '../src/mocks/data.ts'
import { validCpf } from '../src/lib/format.ts'

test('rejects invalid or repeated-digit CPF and accepts a valid test CPF', () => {
  assert.equal(validCpf('123.456.789-09'), true)
  assert.equal(validCpf('123.456.789-00'), false)
  assert.equal(validCpf('111.111.111-11'), false)
})

test('discount uses whole cents and handles rounding at one cent', () => {
  assert.deepEqual(calculateDiscount(19999, 20), { discountCents: 4000, finalCents: 15999 })
  assert.deepEqual(calculateDiscount(5, 10), { discountCents: 1, finalCents: 4 })
})

test('blocked and expired members cannot receive a benefit', () => {
  const base = { status: 'active', paidThrough: new Date(Date.now() + 86400000).toISOString() }
  assert.equal(isEligible(base), true)
  assert.equal(isEligible({ ...base, status: 'blocked' }), false)
  assert.equal(isEligible({ ...base, paidThrough: new Date(Date.now() - 86400000).toISOString() }), false)
})

test('reversed purchases no longer contribute to displayed savings', () => {
  const purchases = [
    { memberId: 'a', discountCents: 500 },
    { memberId: 'a', discountCents: 250, reversedAt: new Date().toISOString() },
    { memberId: 'b', discountCents: 300 },
  ]
  assert.equal(memberSavings('a', purchases), 500)
})

test('a work session is valid only for its active employee and assigned partner', () => {
  const state = {
    partners: [{ id: 'vida' }, { id: 'studio' }],
    employees: [{ id: 'marina', partnerId: 'vida', active: true }],
  }
  assert.equal(activeWorkAssignment(state, { employeeId: 'marina', partnerId: 'vida' })?.partner.id, 'vida')
  assert.equal(activeWorkAssignment(state, { employeeId: 'marina', partnerId: 'studio' }), null)
  state.employees[0].active = false
  assert.equal(activeWorkAssignment(state, { employeeId: 'marina', partnerId: 'vida' }), null)
})
