import { lazy, Suspense } from 'react'
import { ShieldCheck } from 'lucide-react'
import { readPublicConfig } from '../lib/config'
import { Gate } from '../components/identity'
import { PwaInstallProvider } from '../components/MemberInstallPrompt'

// Vite removes the demo import entirely from a sandbox build, including its fixture data.
const DemoApp = import.meta.env.VITE_APP_MODE === 'sandbox' ? null : lazy(() => import('../mocks/DemoApp'))
const SandboxApp = lazy(() => import('./SandboxApp'))

export default function App() {
  try {
    const config = readPublicConfig(import.meta.env)
    return <PwaInstallProvider><Suspense fallback={<div role="status" className="gate-page">Carregando RKMED…</div>}>
      {config.mode === 'demo' && DemoApp ? <DemoApp /> : <SandboxApp config={config} />}
    </Suspense></PwaInstallProvider>
  } catch {
    return <Gate icon={<ShieldCheck size={26} />} title="Configuração necessária" detail="Não foi possível iniciar o sistema. Confira a configuração do ambiente e tente novamente." action="Recarregar" onAction={() => window.location.reload()} />
  }
}
