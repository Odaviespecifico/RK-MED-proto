export type PublicPartner = { id: string; name: string; segment: string; discount: number; address: string; initials: string; tone: string }
export type OtpChannel = 'email' | 'whatsapp' | 'sms'
export type OtpRequest = { contact: string; channel: OtpChannel }
export type MemberAuth = {
  requestCode(request: OtpRequest): Promise<void>
  verifyCode(request: OtpRequest & { token: string }): Promise<{ userId: string }>
}

export class IntegrationError extends Error {}
