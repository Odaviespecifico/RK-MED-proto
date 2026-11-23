import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { onlyDigits } from '../../lib/format'

export function SellerLoginForm({ client, online, onSuccess }: { client: SupabaseClient; online: boolean; onSuccess: () => Promise<void> }) {
  const [establishmentCode, setEstablishmentCode] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!online || busy) return
    setBusy(true); setError('')
    try {
      const { data, error: fnError } = await client.functions.invoke('phone-code', {
        body: {
          action: 'seller_login',
          establishmentCode: establishmentCode.trim().toUpperCase(),
          employeeCode: onlyDigits(employeeCode),
        },
      })
      if (fnError || data?.error || !data?.session?.access_token || !data?.session?.refresh_token) {
        let message = data?.error
        if (!message && fnError && 'context' in fnError && fnError.context instanceof Response) {
          try { message = (await fnError.context.json()).error } catch {}
        }
        throw new Error(typeof message === 'string' && message.length < 200 ? message : 'Código do estabelecimento ou do funcionário inválido.')
      }
      const { error: sessionError } = await client.auth.setSession(data.session)
      if (sessionError) throw new Error('Não foi possível iniciar sua sessão no balcão.')
      setEmployeeCode('')
      await onSuccess()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar como vendedor.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="counter-flow" onSubmit={event => void submit(event)}>
    <h2>Acesso do vendedor</h2>
    <p>Informe o código do estabelecimento e o seu código de funcionário para abrir o balcão de atendimento.</p>
    <label className="field-label">
      Código do estabelecimento (10 caracteres)
      <input
        className="input"
        value={establishmentCode}
        onChange={e => { setEstablishmentCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)); setError('') }}
        placeholder="EX: ABCD123456"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        minLength={10}
        maxLength={10}
        disabled={busy}
      />
    </label>
    <label className="field-label">
      Código do funcionário
      <input
        className="input"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={employeeCode}
        onChange={e => { setEmployeeCode(onlyDigits(e.target.value).slice(0, 12)); setError('') }}
        placeholder="0000"
        required
        minLength={4}
        maxLength={12}
        disabled={busy}
      />
    </label>
    <Button type="submit" className="full" disabled={!online || busy}>
      {busy ? 'Validando acesso…' : 'Entrar no balcão'} <ArrowRight size={18} />
    </Button>
    {!online && <p role="status">Conecte-se à internet para entrar.</p>}
    {error && <div className="inline-error" role="alert"><CircleAlert size={16} />{error}</div>}
  </form>
}
