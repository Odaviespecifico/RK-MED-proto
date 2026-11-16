export class PublicError extends Error {}
// Match complete origins only; callbacks keep using the canonical APP_ORIGIN.
export function allowedRequestOrigin(request: Request, env: Record<string, string | undefined>) {
  const origin = request.headers.get('origin')
  if (!origin || origin === 'null') return undefined
  try {
    const url = new URL(origin)
    if (url.origin !== origin) return undefined
    const loopback = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(loopback && ['local', 'sandbox'].includes(env.APP_ENV || ''))) return undefined
    const allowed = [env.APP_ORIGIN, ...(env.CORS_ALLOWED_ORIGINS || '').split(',').map(value => value.trim())]
    return allowed.includes(origin) ? origin : undefined
  } catch { return undefined }
}
export async function boundedBody(request: Request, max = 64 * 1024) {
  if (Number(request.headers.get('content-length') || 0) > max || !request.body) throw new Error('Requisição inválida.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) throw new Error('Requisição muito grande.'); chunks.push(value) } }
  finally { await reader.cancel() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(bytes)
}
export function response(data: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) } })
}
