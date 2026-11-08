import * as tf from '@tensorflow/tfjs'
import { load } from '@tensorflow-models/blazeface'
import modelUrl from '../../supabase/functions/_shared/models/model.json?url'
import weightsUrl from '../../supabase/functions/_shared/models/group1-shard1of1.bin?url'

let modelPromise: ReturnType<typeof load> | undefined

async function getModel() {
  if (!modelPromise) modelPromise = (async () => {
    await tf.setBackend('cpu')
    await tf.ready()
    const [manifestResponse, weightsResponse] = await Promise.all([fetch(modelUrl), fetch(weightsUrl)])
    if (!manifestResponse.ok || !weightsResponse.ok) throw new Error('Não foi possível carregar a análise facial. Confira a conexão e tente novamente.')
    const manifest = await manifestResponse.json()
    const weightData = await weightsResponse.arrayBuffer()
    return load({
      modelUrl: tf.io.fromMemory({ modelTopology: manifest.modelTopology, weightSpecs: manifest.weightsManifest.flatMap((group: { weights: tf.io.WeightsManifestEntry[] }) => group.weights), weightData }),
      maxFaces: 3, scoreThreshold: 0.8,
    })
  })().catch(error => { modelPromise = undefined; throw error })
  return modelPromise
}

export async function detectCpuFace(pixels: ImageData) {
  const model = await getModel()
  const tensor = tf.browser.fromPixels(pixels)
  try {
    const faces = await model.estimateFaces(tensor, false, false, true)
    return faces.map(face => {
      const [left, top] = face.topLeft as [number, number]
      const [right, bottom] = face.bottomRight as [number, number]
      return {
        categories: [{ score: Array.isArray(face.probability) ? Number(face.probability[0]) : Number(face.probability) }],
        boundingBox: { originX: left, originY: top, width: right - left, height: bottom - top },
      }
    })
  } finally { tensor.dispose() }
}
