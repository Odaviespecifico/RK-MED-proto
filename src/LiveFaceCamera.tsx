import { useEffect, useRef, useState } from 'react'
import { Camera, CircleAlert, X } from 'lucide-react'
import { Button } from './components/ui/button'
import { countUsableFaces, createLiveFaceDetector } from './lib/face'

type Props = { onCapture: (file: File) => void; onClose: () => void }

export function LiveFaceCamera({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const countRef = useRef(0)
  const [state, setState] = useState<'starting' | 'ready' | 'error'>('starting')
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    let active = true
    let stream: MediaStream | undefined
    let detector: Awaited<ReturnType<typeof createLiveFaceDetector>> | undefined
    let frame = 0
    let lastCheck = 0
    let consecutiveFaceFrames = 0

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('A câmera não está disponível neste navegador. Use a opção de escolher foto.')
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
        if (!active) { stream.getTracks().forEach(track => track.stop()); return }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        if (!active) return
        detector = await createLiveFaceDetector()
        if (!active) { detector.close(); return }
        setState('ready')
        async function check(now: number) {
          if (!active) return
          if (video && detector && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && now - lastCheck >= 150) {
            lastCheck = now
            try {
              const result = await detector.detectForVideo(video, now)
              if (!active) return
              const detected = countUsableFaces(result.detections, video.videoWidth, video.videoHeight, true)
              consecutiveFaceFrames = detected === 1 ? consecutiveFaceFrames + 1 : 0
              const next = detected === 1 && consecutiveFaceFrames < 3 ? 0 : detected
              countRef.current = next
              setCount(previous => previous === next ? previous : next)
            } catch {
              if (!active) return
              setError('Não foi possível analisar a imagem da câmera. Tente escolher uma foto.')
              setState('error')
              stream?.getTracks().forEach(track => track.stop())
              return
            }
          }
          frame = requestAnimationFrame(check)
        }
        frame = requestAnimationFrame(check)
      } catch (cause) {
        if (!active) return
        const permissionDenied = cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'PermissionDeniedError')
        setError(permissionDenied ? 'Acesso à câmera negado. Autorize nas configurações do navegador ou escolha uma foto.' : cause instanceof Error ? cause.message : 'Não foi possível abrir a câmera. Escolha uma foto.')
        setState('error')
        stream?.getTracks().forEach(track => track.stop())
      }
    }
    void start()
    return () => {
      active = false
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach(track => track.stop())
      detector?.close()
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [])

  function capture() {
    const video = videoRef.current
    if (!video || state !== 'ready' || countRef.current !== 1 || capturing) return
    setCapturing(true)
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) { setCapturing(false); setError('Não foi possível capturar a foto. Tente novamente.'); return }
    context.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      setCapturing(false)
      if (!blob) { setError('Não foi possível capturar a foto. Tente novamente.'); return }
      onCapture(new File([blob], 'foto-camera.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.85)
  }

  const message = state === 'starting' ? 'Abrindo câmera e preparando detecção...' : count === 1 ? 'Um rosto detectado. Você pode tirar a foto.' : count > 1 ? 'Mais de um rosto detectado. Fique sozinha na imagem.' : 'Posicione seu rosto de frente, em um local bem iluminado.'
  return <div className="live-camera">
    <div className="live-camera-head"><b>Câmera frontal</b><button type="button" onClick={onClose} aria-label="Fechar câmera"><X size={20} /></button></div>
    <div className="live-camera-preview"><video ref={videoRef} autoPlay muted playsInline aria-label="Prévia da câmera frontal" /><span className={`live-camera-guide ${state === 'ready' && count === 1 ? 'detected' : ''}`} aria-hidden="true" /></div>
    {state === 'error' ? <div className="inline-error" role="alert"><CircleAlert size={17} />{error}</div> : <p className={`live-camera-status ${count === 1 ? 'detected' : ''}`} role="status" aria-live="polite">{message}</p>}
    {error && state !== 'error' && <div className="inline-error" role="alert"><CircleAlert size={17} />{error}</div>}
    <Button type="button" className="full" disabled={state !== 'ready' || count !== 1 || capturing} onClick={capture}><Camera size={17} /> {capturing ? 'Capturando...' : 'Tirar foto'}</Button>
  </div>
}
