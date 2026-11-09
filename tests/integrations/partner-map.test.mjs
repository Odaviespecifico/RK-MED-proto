import test from 'node:test'
import assert from 'node:assert/strict'
import { partnerMapLinks } from '../../src/lib/partner-map.ts'

test('map remains embedded and interactive without a configured API key', () => {
  const links = partnerMapLinks('Rua da Matriz, 145 · Carpina, PE')
  const url = new URL(links.embed)
  assert.equal(url.origin, 'https://www.google.com')
  assert.equal(url.searchParams.get('output'), 'embed')
  assert.equal(url.searchParams.get('q'), 'Rua da Matriz, 145, Carpina, PE, Brasil')
  assert.equal(url.searchParams.get('hl'), 'pt-BR')
  assert.equal(url.searchParams.has('key'), false)
  assert.equal(new URL(links.external).searchParams.get('query'), url.searchParams.get('q'))
})

test('configured Maps Embed API preserves the same address and Portuguese controls', () => {
  const url = new URL(partnerMapLinks('Carpina, PE, Brasil', ' public-test-key ').embed)
  assert.equal(url.pathname, '/maps/embed/v1/place')
  assert.equal(url.searchParams.get('key'), 'public-test-key')
  assert.equal(url.searchParams.get('q'), 'Carpina, PE, Brasil')
  assert.equal(url.searchParams.get('language'), 'pt-BR')
})

test('missing addresses never open an unrelated map, and special characters remain query data', () => {
  assert.equal(partnerMapLinks('   '), null)
  const url = new URL(partnerMapLinks('Rua A & B #2 <teste>').embed)
  assert.equal(url.hostname, 'www.google.com')
  assert.equal(url.searchParams.get('q'), 'Rua A & B #2 <teste>, Brasil')
  assert.equal(url.hash, '')
})
