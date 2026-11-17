// D30 and the server-validated Stripe catalog use 6990 BRL cents per month.
export const goldPlan = { name: 'Linha Gold', monthlyCents: 6990 } as const

export function maskedContact(contact: string, channel: 'email' | 'sms') {
  if (channel === 'email') {
    const [name, domain = ''] = contact.trim().split('@')
    const dot = domain.lastIndexOf('.')
    return `${name.slice(0, 2)}•••@${domain.slice(0, 1)}•••${dot >= 0 ? domain.slice(dot) : ''}`
  }
  return `•• •••••-${contact.replace(/\D/g, '').slice(-4)}`
}
