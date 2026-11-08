import { PublicError } from './http.ts'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
import { load } from '@tensorflow-models/blazeface'
import jpeg from 'jpeg-js'

type ReadBytes = (path: URL) => Promise<Uint8Array>
let modelPromise: ReturnType<typeof load> | undefined
let processing = false
async function detector(read: ReadBytes) {
  if (!modelPromise) modelPromise = (async () => {
    await tf.setBackend('cpu'); await tf.ready()
    const manifest = JSON.parse(new TextDecoder().decode(await read(new URL('./models/model.json', import.meta.url))))
    const weights = await read(new URL('./models/group1-shard1of1.bin', import.meta.url))
    return load({ modelUrl: tf.io.fromMemory({ modelTopology: manifest.modelTopology, weightSpecs: manifest.weightsManifest.flatMap((group: { weights: tf.io.WeightsManifestEntry[] }) => group.weights), weightData: weights.slice().buffer }), maxFaces: 3, scoreThreshold: 0.8 })
  })().catch(error => { modelPromise = undefined; throw error })
  return modelPromise
}
export async function sanitizePhoto(bytes: Uint8Array, read: ReadBytes): Promise<Uint8Array> {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new PublicError('Envie uma foto JPEG com até 5 MB.')
  if (processing) throw new PublicError('Processando outra foto. Tente novamente em instantes.')
  processing = true
  try {
    let image
    try { image = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 1, maxMemoryUsageInMB: 32, tolerantDecoding: false }) } catch { throw new PublicError('Foto inválida. Escolha outra imagem.') }
    if (image.width !== 600 || image.height !== 600) throw new PublicError('Envie o recorte de 600 por 600 pixels.')
    const model = await detector(read)
    const rgb = new Int32Array(600 * 600 * 3)
    for (let p = 0; p < 600 * 600; p++) for (let c = 0; c < 3; c++) rgb[p * 3 + c] = image.data[p * 4 + c]
    const tensor = tf.tensor3d(rgb, [600, 600, 3], 'int32')
    try {
      const faces = await model.estimateFaces(tensor, false, false, false)
      if (faces.length !== 1 || !Array.isArray(faces[0].topLeft) || !Array.isArray(faces[0].bottomRight)) throw new PublicError('Use uma foto nítida com apenas um rosto.')
      const [left, top] = faces[0].topLeft
      const [right, bottom] = faces[0].bottomRight
      if (right - left < 120 || bottom - top < 120 || left < 0 || top < 0 || right > 600 || bottom > 600) throw new PublicError('Centralize o rosto e aproxime a câmera.')
    } finally { tensor.dispose() }
    // Construct a fresh encoder input; EXIF/comments/metadata from the decoder are discarded.
    return new Uint8Array(jpeg.encode({ data: image.data, width: 600, height: 600 }, 90).data)
  } finally { processing = false }
}
