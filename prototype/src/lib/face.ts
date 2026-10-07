let detectorPromise: Promise<import('@mediapipe/tasks-vision').FaceDetector> | undefined

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks('/wasm')
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.6,
      })
    })().catch(error => { detectorPromise = undefined; throw error })
  }
  return detectorPromise
}

export async function detectFace(file: File): Promise<{ preview: string; count: number }> {
  if (!['image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(file.type.toLowerCase())) throw new Error('Use uma foto JPG, PNG ou HEIC.')
  if (file.size > 5 * 1024 * 1024) throw new Error('A foto deve ter no máximo 5 MB.')
  const image = await createImageBitmap(file).catch(() => { throw new Error('Não foi possível abrir esta imagem. Tente uma foto JPG ou PNG.') })
  try {
    const detector = await getDetector()
    const result = detector.detect(image)
    const canvas = document.createElement('canvas')
    const side = Math.min(image.width, image.height)
    canvas.width = 600
    canvas.height = 600
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a foto.')
    ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 600, 600)
    return { preview: canvas.toDataURL('image/jpeg', 0.76), count: result.detections.length }
  } finally { image.close() }
}

export async function createLiveFaceDetector() {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks('/wasm')
  return FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'CPU' },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.6,
  })
}
