/// <reference types="vite-plugin-pwa/client" />
import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { Button } from './ui/button'

export function AppUpdate() {
  const [available, setAvailable] = useState(false)
  const update = useRef<(reload?: boolean) => Promise<void>>(async () => {})
  useEffect(() => {
    update.current = registerSW({ onNeedRefresh: () => setAvailable(true) })
  }, [])
  if (!available) return null
  return <aside className="app-update" role="status"><span>Uma atualização da RKMED está disponível. Conclua o que estiver fazendo antes de atualizar.</span><Button onClick={() => void update.current(true)}>Atualizar agora</Button></aside>
}
