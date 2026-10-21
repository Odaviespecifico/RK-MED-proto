import test from 'node:test'
import assert from 'node:assert/strict'
import { purchasesCsv, reportMoney, recifeDate } from '../../src/lib/reports.ts'
const row = { id: 'record-test', memberName: 'Ana', cpf: '***.***.***-09', partnerName: 'Parceiro', employee: 'Marina', grossCents: '20000', discountCents: '4000', finalCents: '16000', createdAt: '2026-01-02T02:00:00Z', reversedAt: null }
const report = rows => ({ from: '2026-01-01', to: '2026-01-02', partnerId: null, generatedAt: '2026-01-03T12:00:00Z', rows })
test('RF-ADM: CSV quotes separators, flattens controls and labels formula-like names as text', () => {
  for (const name of ['=1+1', '+1+1', '-1+1', '@SUM(1)', '\t=1', '\r\n=1', '  ＝1', '＠SUM(1)', '＋1', '－1']) {
    const csv = purchasesCsv(report([{ ...row, memberName: name }]))
    assert.match(csv, /"Texto: /)
    assert.equal(csv.split('\r\n').length, 3)
  }
  assert.ok(purchasesCsv(report([{ ...row, partnerName: 'Nome";=1+1\nTeste' }])).includes('"Nome"";=1+1 Teste"'))
})
test('RF-ADM: exports reject raw CPF and retain exact large amounts and Recife dates', () => {
  assert.throws(() => purchasesCsv(report([{ ...row, cpf: '12345678909' }])), /CPF não mascarado/)
  assert.equal(reportMoney('18014398509481982'), 'R$ 180.143.985.094.819,82')
  assert.ok(purchasesCsv(report([row])).includes('"200,00";"40,00";"160,00";"01/01/2026'))
  assert.equal(recifeDate(new Date('2026-01-02T02:00:00Z')), '2026-01-01')
})
