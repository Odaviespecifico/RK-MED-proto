import test from 'node:test'
import assert from 'node:assert/strict'
import { watchOperations } from '../../src/integrations/operational.ts'

test('RF-NOT: realtime watches only the minimal signal, refreshes on reconnect and detaches on exit', () => {
  let changed, subscribed, removed = 0, invalidations = 0
  const states = []
  const channel = {
    on(type, filter, callback) {
      assert.equal(type, 'postgres_changes')
      assert.deepEqual(filter, { event: 'UPDATE', schema: 'public', table: 'rk_operational_signal', filter: 'id=eq.1' })
      changed = callback; return this
    },
    subscribe(callback) { subscribed = callback; return this },
  }
  const client = { channel: () => channel, removeChannel: async value => { assert.equal(value, channel); removed++ } }
  const stop = watchOperations(client, () => invalidations++, value => states.push(value))
  subscribed('SUBSCRIBED'); changed({ new: { revision: 1 } })
  subscribed('CHANNEL_ERROR'); subscribed('SUBSCRIBED')
  assert.equal(invalidations, 3)
  assert.deepEqual(states, ['connected', 'interrupted', 'connected'])
  stop(); changed({ new: { revision: 2 } }); subscribed('SUBSCRIBED')
  assert.equal(removed, 1); assert.equal(invalidations, 3)
})
