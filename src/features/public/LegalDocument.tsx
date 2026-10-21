import { useEffect, useState } from 'react'
import type { Portal } from '../../integrations/portal'
import { Brand } from '../../components/identity'
import { Button } from '../../components/ui/button'

export function LegalDocument({ api, kind, go }: { api: Portal; kind: 'terms' | 'privacy'; go: (path: string) => void }) {
  const [document, setDocument] = useState<{ version: string; content: string } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setDocument(null); setError('')
    api.documents().then(rows => {
      if (!active) return
      const row = rows.find(item => item.kind === kind)
      if (row) setDocument(row)
      else setError('Documento indisponível. Tente novamente quando estiver conectado.')
    }).catch(() => { if (active) setError('Não foi possível carregar o documento. Confira sua conexão.') })
    return () => { active = false }
  }, [api, kind])
  return <main className="workspace-main"><Brand /><article className="surface-card">
    <h1>{kind === 'terms' ? 'Termos de uso' : 'Aviso de privacidade'}</h1>
    <p>Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.</p>
    {error ? <p role="alert">{error}</p> : document ? <><p>Versão: {document.version}</p><div style={{ whiteSpace: 'pre-wrap' }}>{document.content}</div></> : <p role="status">Carregando documento...</p>}
    <Button variant="ghost" onClick={() => go('/')}>Voltar ao início</Button>
  </article></main>
}
