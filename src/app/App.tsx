import { lazy, Suspense } from 'react'
import { ShieldCheck } from 'lucide-react'
import { readPublicConfig } from '../lib/config'
import { Gate } from '../components/identity'

// Vite removes the demo import entirely from a sandbox build, including its fixture data.
const DemoApp = import.meta.env.VITE_APP_MODE === 'sandbox' ? null : lazy(() => import('../mocks/DemoApp'))
const SandboxApp = lazy(() => import('./SandboxApp'))

export default function App() {
  try {
    const config = readPublicConfig(import.meta.env)
    return <Suspense fallback={<div role="status" className="gate-page">Carregando RKMED…</div>}>
      {config.mode === 'demo' && DemoApp ? <DemoApp /> : <SandboxApp config={config} />}
    </Suspense>
  } catch {
    return <Gate icon={<ShieldCheck size={26} />} title="Configuração de testes necessária" detail="Confira a configuração pública do ambiente. O acesso não foi substituído por uma sessão de demonstração." action="Recarregar" onAction={() => window.location.reload()} />
  }
}
