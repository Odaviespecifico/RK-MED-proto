export function partnerMapLinks(address: string, apiKey = '') {
  const clean = address.replace(/\s*·\s*/g, ', ').replace(/\s+/g, ' ').trim()
  if (!clean) return null
  const query = /\b(brasil|brazil)$/i.test(clean) ? clean : `${clean}, Brasil`
  const key = apiKey.trim()
  const embed = key
    ? `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key, q: query, language: 'pt-BR', zoom: '16' })}`
    : `https://www.google.com/maps?${new URLSearchParams({ q: query, output: 'embed', hl: 'pt-BR', z: '16' })}`
  return { embed, external: `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query })}` }
}
