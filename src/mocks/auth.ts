import type { MemberAuth } from '../integrations/contracts'
import { DEMO_OTP, type DemoState } from './data'
import { onlyDigits } from '../lib/format'

export function createDemoAuth(data: DemoState): MemberAuth {
  return {
    async requestCode() { /* Demonstration transport: deliberately no messages or provider requests. */ },
    async verifyCode({ channel, contact, token }) {
      if (token !== DEMO_OTP) throw new Error('Código incorreto. Neste protótipo, use 123456.')
      const member = data.members.find(item => channel === 'email'
        ? item.email.toLowerCase() === contact.trim().toLowerCase()
        : onlyDigits(item.phone) === onlyDigits(contact))
      if (!member) throw new Error('Associado não encontrado. Use ana@exemplo.com ou 81999990001.')
      return { userId: member.id }
    },
  }
}
