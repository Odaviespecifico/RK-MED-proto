import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import noSimdLoaderPath from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url'
import noSimdBinaryPath from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url'

export async function createMediaPipeDetector(runningMode: 'IMAGE' | 'VIDEO', minDetectionConfidence: number) {
  const simd = await FilesetResolver.isSimdSupported()
  // Bundle the runtime belonging to the installed package, avoiding stale public/wasm copies.
  return FaceDetector.createFromOptions({
    wasmLoaderPath: simd ? wasmLoaderPath : noSimdLoaderPath,
    wasmBinaryPath: simd ? wasmBinaryPath : noSimdBinaryPath,
  }, {
    baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'CPU' },
    runningMode, minDetectionConfidence,
  })
}
