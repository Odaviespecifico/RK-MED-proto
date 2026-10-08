import test from 'node:test'
import assert from 'node:assert/strict'
import { countUsableFaces, faceConfidenceFromEnv } from '../src/lib/face.ts'

const face = (score, box = { originX: 170, originY: 120, width: 260, height: 310 }) => ({
  categories: [{ score }], boundingBox: box,
})

test('uses a valid configured confidence and falls back for missing or invalid values', () => {
  assert.equal(faceConfidenceFromEnv('0.9'), 0.9)
  assert.equal(faceConfidenceFromEnv(''), 0.8)
  assert.equal(faceConfidenceFromEnv('1.2'), 0.8)
  assert.equal(faceConfidenceFromEnv('not-a-number'), 0.8)
})

test('requires one clear, sufficiently large face inside the saved photo', () => {
  assert.equal(countUsableFaces([face(0.91)], 600, 600), 1)
  assert.equal(countUsableFaces([face(0.79)], 600, 600), 0)
  assert.equal(countUsableFaces([face(0.91, { originX: 250, originY: 260, width: 85, height: 90 })], 600, 600), 0)
  assert.equal(countUsableFaces([face(0.91, { originX: -10, originY: 120, width: 260, height: 310 })], 600, 600), 0)
  assert.equal(countUsableFaces([face(0.91), face(0.88)], 600, 600), 2)
  assert.equal(countUsableFaces([face(0.91, { originX: 30, originY: 120, width: 240, height: 310 })], 1280, 720, true), 0)
})
