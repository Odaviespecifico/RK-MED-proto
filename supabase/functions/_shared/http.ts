export class PublicError extends Error {}
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
