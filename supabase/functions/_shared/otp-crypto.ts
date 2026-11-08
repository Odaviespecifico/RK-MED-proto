// Provider-independent cryptographic operations. Rejection sampling avoids modulo bias.
export function generateOtp(random: typeof crypto.getRandomValues = crypto.getRandomValues.bind(crypto)): string {
  const sample = new Uint32Array(1)
  do { random(sample) } while (sample[0] >= 4294000000)
  return String(sample[0] % 1000000).padStart(6, '0')
}
export async function otpDigest(secret: string, scope: string, value: string): Promise<string> {
  if (secret.length < 32) throw new Error('Configure OTP_HMAC_SECRET com pelo menos 32 caracteres aleatórios.')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify([scope, value])))
  return Array.from(new Uint8Array(signature), x => x.toString(16).padStart(2, '0')).join('')
}
