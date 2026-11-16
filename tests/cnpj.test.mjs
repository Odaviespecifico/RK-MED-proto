import test from 'node:test'
import assert from 'node:assert/strict'
import { validCnpj } from '../src/lib/format.ts'

test('valida CNPJ e rejeita dígitos incorretos e excesso de caracteres', () => {
 assert.equal(validCnpj('11.222.333/0001-81'), true)
 for (const value of ['11.222.333/0001-82', '112223330001811', '11111111111111']) assert.equal(validCnpj(value), false)
})
