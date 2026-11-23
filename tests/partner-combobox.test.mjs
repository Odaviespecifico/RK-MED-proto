import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPartnerOptionLabel, matchesPartnerQuery } from '../src/lib/partner-search.ts'

test('matchesPartnerQuery matches by accent-insensitive name, formatted CNPJ, and raw CNPJ digits', () => {
  const partner = { id: 'p1', name: 'Clínica Vida Saúde', cnpj: '11222333000181', segment: 'Laboratório', active: true }
  assert.equal(matchesPartnerQuery(partner, ''), true)
  assert.equal(matchesPartnerQuery(partner, 'clinica vida'), true)
  assert.equal(matchesPartnerQuery(partner, 'SAÚDE'), true)
  assert.equal(matchesPartnerQuery(partner, '11.222.333/0001-81'), true)
  assert.equal(matchesPartnerQuery(partner, '11222333'), true)
  assert.equal(matchesPartnerQuery(partner, '99999999'), false)
  assert.equal(formatPartnerOptionLabel(partner), 'Clínica Vida Saúde · 11.222.333/0001-81')
})
