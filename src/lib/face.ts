type Detection = {
  categories: { score: number }[]
  boundingBox?: { originX: number; originY: number; width: number; height: number }
}

export function faceConfidenceFromEnv(value: string | undefined) {
  const parsed = Number(value)
  return value?.trim() && Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : 0.8
}

const MIN_FACE_CONFIDENCE = faceConfidenceFromEnv(import.meta.env?.VITE_FACE_DETECTION_MIN_CONFIDENCE)
const MIN_FACE_SIDE_RATIO = 0.2
let detectorPromise: ReturnType<typeof createDetector> | undefined

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

function graphicsUnavailable(error: unknown) {
  return error instanceof Error && /activeTexture|webgl|gpu service|gl context|create_context/i.test(error.message)
}

async function createDetector(runningMode: 'IMAGE' | 'VIDEO') {
  let detector: import('@mediapipe/tasks-vision').FaceDetector | undefined
  let closed = false
  // MediaPipe's image upload can require WebGL even with the CPU delegate.
  const probe = document.createElement('canvas')
  const gl = probe.getContext('webgl2')
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  if (gl) {
    try {
      const { createMediaPipeDetector } = await import('./faceMediapipe')
      detector = await createMediaPipeDetector(runningMode, MIN_FACE_CONFIDENCE)
    } catch (error) { if (!graphicsUnavailable(error)) throw error }
  }
  const canvas = document.createElement('canvas')
  const canvasContext = canvas.getContext('2d', { willReadFrequently: true })
  if (!canvasContext) throw new Error('Não foi possível processar a foto neste navegador.')
  const context = canvasContext
  async function detect(input: HTMLCanvasElement | HTMLVideoElement, timestamp?: number): Promise<{ detections: Detection[] }> {
    if (closed) throw new Error('A câmera foi encerrada. Abra novamente para continuar.')
    if (detector) {
      try { return timestamp === undefined ? detector.detect(input) : detector.detectForVideo(input, timestamp) }
      catch (error) {
        if (!graphicsUnavailable(error)) throw error
        try { detector.close() } catch { /* A lost graphics context may also reject disposal. */ }
        detector = undefined
      }
    }
    const width = input instanceof HTMLVideoElement ? input.videoWidth : input.width
    const height = input instanceof HTMLVideoElement ? input.videoHeight : input.height
    // Bound CPU work while keeping the source aspect ratio and face coordinates.
    const scale = Math.min(1, 600 / Math.max(width, height))
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    context.drawImage(input, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const { detectCpuFace } = await import('./faceCpu')
    const faces = await detectCpuFace(pixels)
    return { detections: faces.map(face => ({ ...face, boundingBox: {
      originX: face.boundingBox.originX * width / pixels.width, originY: face.boundingBox.originY * height / pixels.height,
      width: face.boundingBox.width * width / pixels.width, height: face.boundingBox.height * height / pixels.height,
    } })) }
  }
  return {
    detect: (input: HTMLCanvasElement) => detect(input),
    detectForVideo: (input: HTMLVideoElement | HTMLCanvasElement, timestamp: number) => detect(input, timestamp),
    close() { closed = true; detector?.close(); detector = undefined },
  }
}

async function getDetector() {
  if (!detectorPromise) detectorPromise = createDetector('IMAGE').catch(error => { detectorPromise = undefined; throw error })
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
    const count = countUsableFaces((await detector.detect(canvas)).detections, canvas.width, canvas.height)
    return { preview: canvas.toDataURL('image/jpeg', 0.76), count }
  } finally { image.close() }
}

export async function createLiveFaceDetector() {
  return createDetector('VIDEO')
}
