import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDatasetCsv, defaultSelectedFields } from '../src/lib/data-export.ts'

test('buildDatasetCsv exports only selected columns in canonical order and neutralizes formulas', () => {
  const csv = buildDatasetCsv('partners', [
    { name: '=SUM(A1:A2)', segment: 'Academia', cnpj: '11222333000181', discountPercent: 15, active: true, purchasesCount: 4, grossCents: '40000', discountCents: '6000' },
  ], ['name', 'discountPercent', 'grossCents'])
  assert.ok(csv.startsWith('\uFEFF'))
  const lines = csv.slice(1).trim().split('\r\n')
  assert.equal(lines[0], '"Nome do parceiro";"Desconto (%)";"Valor bruto no período (BRL)"')
  assert.equal(lines[1], '"Texto: =SUM(A1:A2)";"15,00%";"400,00"')
})

test('buildDatasetCsv rejects unmasked CPF and empty field selection', () => {
  assert.throws(() => buildDatasetCsv('members', [], []), /Selecione ao menos um campo/)
  assert.throws(() => buildDatasetCsv('members', [{ name: 'Ana', cpf: '12345678901' }], ['name', 'cpf']), /CPF não mascarado/)
})

test('buildDatasetCsv formats financial dataset with operational fee labels', () => {
  const csv = buildDatasetCsv('financial', [
    { invoiceId: 'in_123', memberName: 'Ana', cpf: '***.***.***-01', paidAmountCents: '6990', operationalFeeCents: '1587', netRkmedCents: '5403', feeStatus: 'sent', createdAt: '2026-11-20T12:00:00Z' },
  ], ['invoiceId', 'memberName', 'cpf', 'paidAmountCents', 'operationalFeeCents', 'netRkmedCents', 'feeStatus'])
  const lines = csv.slice(1).trim().split('\r\n')
  assert.equal(lines.length, 2)
  assert.match(lines[1], /"in_123";"Ana";"\*\*\*\.\*\*\*\.\*\*\*-01";"69,90";"15,87";"54,03";"Taxa processada"/)
  assert.ok(defaultSelectedFields('financial').includes('netRkmedCents'))
})
