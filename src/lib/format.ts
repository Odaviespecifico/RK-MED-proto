export function brl(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100) }
export function shortDate(iso: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) }
export function maskedCpf(cpf: string) { return `***.***.***-${cpf.slice(-2)}` }
export function onlyDigits(value: string) { return value.replace(/\D/g, '') }
export function validCpf(value: string) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  const digit = (length: number) => {
    const sum = Array.from(cpf.slice(0, length)).reduce((acc, v, i) => acc + Number(v) * (length + 1 - i), 0)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}
export function onlyCnpjChars(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14) }
export function formatCnpj(value: string) {
  const cnpj = onlyCnpjChars(value)
  if (cnpj.length <= 2) return cnpj
  if (cnpj.length <= 5) return `${cnpj.slice(0, 2)}.${cnpj.slice(2)}`
  if (cnpj.length <= 8) return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5)}`
  if (cnpj.length <= 12) return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8)}`
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}
export function validCnpj(value: string) {
  const cnpj = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj) || /^([A-Z0-9])\1{13}$/.test(cnpj)) return false
  const digit = (length: number) => {
    const sum = Array.from(cnpj.slice(0, length)).reduce((total, char, index) => {
      const weight = ((length - index - 1) % 8) + 2
      return total + (char.charCodeAt(0) - 48) * weight
    }, 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13])
}
export function isAdult(date: string) {
  const birth = new Date(`${date}T12:00:00`)
  if (!Number.isFinite(birth.getTime())) return false
  const now = new Date()
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  return birth <= cutoff
}
