import type { Detection } from '@mediapipe/tasks-vision'

export function faceConfidenceFromEnv(value: string | undefined) {
  const parsed = Number(value)
  return value?.trim() && Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : 0.8
}

const MIN_FACE_CONFIDENCE = faceConfidenceFromEnv(import.meta.env?.VITE_FACE_DETECTION_MIN_CONFIDENCE)
const MIN_FACE_SIDE_RATIO = 0.2
let detectorPromise: Promise<import('@mediapipe/tasks-vision').FaceDetector> | undefined

export function countUsableFaces(detections: Detection[], width: number, height: number, requireCenterCrop = false) {
  const credible = detections.filter(detection => detection.boundingBox && detection.categories.some(category => category.score >= MIN_FACE_CONFIDENCE))
  if (credible.length !== 1) return credible.length
  const box = credible[0].boundingBox!
  const minimumSide = Math.min(width, height) * MIN_FACE_SIDE_RATIO
  if (box.width < minimumSide || box.height < minimumSide) return 0
  const left = requireCenterCrop ? (width - Math.min(width, height)) / 2 : 0
  const top = requireCenterCrop ? (height - Math.min(width, height)) / 2 : 0
  const right = requireCenterCrop ? width - left : width
  const bottom = requireCenterCrop ? height - top : height
  if (box.originX < left || box.originY < top || box.originX + box.width > right || box.originY + box.height > bottom) return 0
  return 1
}

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks('/wasm')
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: MIN_FACE_CONFIDENCE,
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
    const canvas = document.createElement('canvas')
    const side = Math.min(image.width, image.height)
    canvas.width = 600
    canvas.height = 600
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a foto.')
    ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 600, 600)
    const detector = await getDetector()
    const count = countUsableFaces(detector.detect(canvas).detections, canvas.width, canvas.height)
    return { preview: canvas.toDataURL('image/jpeg', 0.76), count }
  } finally { image.close() }
}

export async function createLiveFaceDetector() {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks('/wasm')
  return FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'CPU' },
    runningMode: 'VIDEO',
    minDetectionConfidence: MIN_FACE_CONFIDENCE,
  })
}
