export type PublicConfig = {
  mode: 'demo' | 'sandbox'
  environment: 'local' | 'sandbox'
  supabaseUrl: string
  supabaseKey: string
  projectRef: string
}

export function readPublicConfig(env: Record<string, string | boolean | undefined>): PublicConfig {
  for (const [name, value] of Object.entries(env)) {
    if (value && name.startsWith('VITE_') && (/SECRET|SERVICE_ROLE|PASSWORD|TOKEN|TWILIO|STRIPE|SMSDEV|OTP_HMAC/.test(name))) {
      throw new Error('Credencial de servidor encontrada na configuração pública. Remova-a antes de iniciar ou compilar.')
    }
  }
  const mode = env.VITE_APP_MODE || 'demo'
  const environment = env.VITE_APP_ENV || 'local'
  if (mode !== 'demo' && mode !== 'sandbox') throw new Error('VITE_APP_MODE deve ser demo ou sandbox.')
  if (environment !== 'local' && environment !== 'sandbox') throw new Error('Somente ambientes local e sandbox estão habilitados.')
  const supabaseUrl = String(env.VITE_SUPABASE_URL || '')
  const supabaseKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '')
  const projectRef = String(env.VITE_SUPABASE_PROJECT_REF || '')
  if (supabaseKey) {
    let publicKey = supabaseKey.startsWith('sb_publishable_')
    if (!publicKey && supabaseKey.split('.').length === 3) {
      try {
        const payload = supabaseKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
        publicKey = JSON.parse(atob(payload)).role === 'anon'
      } catch { publicKey = false }
    }
    if (!publicKey) throw new Error('Use somente a chave publicável/anon do Supabase no frontend.')
  }
  if (supabaseUrl) {
    let url: URL
    try { url = new URL(supabaseUrl) } catch { throw new Error('URL pública do Supabase inválida.') }
    const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
    const sandbox = url.protocol === 'https:' && /^[a-z0-9]+$/.test(projectRef) && url.hostname === `${projectRef}.supabase.co`
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !(environment === 'local' ? local : sandbox)) {
      throw new Error('A URL do Supabase não corresponde ao ambiente/projeto configurado.')
    }
  }
  if (mode === 'sandbox' && (!supabaseUrl || !supabaseKey)) {
    throw new Error('Configure URL e chave publicável do Supabase para usar o modo sandbox.')
  }
  return { mode, environment, supabaseUrl, supabaseKey, projectRef }
}
