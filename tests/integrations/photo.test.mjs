import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import jpeg from 'jpeg-js'
import { sanitizePhoto } from '../../supabase/functions/_shared/photo.ts'
function resize(image) {
  const data = new Uint8Array(600 * 600 * 4)
  for (let y = 0; y < 600; y++) for (let x = 0; x < 600; x++) { const i = (Math.floor(y * image.height / 600) * image.width + Math.floor(x * image.width / 600)) * 4; data.set(image.data.subarray(i, i + 4), (y * 600 + x) * 4) }
  return jpeg.encode({ data, width: 600, height: 600 }, 90).data
}
test('server rejects invalid photo bytes and dimensions without loading model', async () => {
  await assert.rejects(() => sanitizePhoto(new Uint8Array(16), readFile), /JPEG/)
  const tiny = jpeg.encode({ data: new Uint8Array(4 * 10 * 10), width: 10, height: 10 }).data
  await assert.rejects(() => sanitizePhoto(tiny, readFile), /600/)
})
test('server model accepts one face, strips comments, and rejects no-face photos', async () => {
  const input = resize(jpeg.decode(await readFile(new URL('../fixtures/face-portrait.jpg', import.meta.url))))
  const output = await sanitizePhoto(input, readFile)
  assert.equal(jpeg.decode(output).width, 600)
  assert.equal(jpeg.decode(output).comments?.length || 0, 0)
  const blank = jpeg.encode({ data: new Uint8Array(4 * 600 * 600).fill(255), width: 600, height: 600 }).data
  await assert.rejects(() => sanitizePhoto(blank, readFile), /rosto/)
})
