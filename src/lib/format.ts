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
export function isAdult(date: string) {
  const birth = new Date(`${date}T12:00:00`)
  if (!Number.isFinite(birth.getTime())) return false
  const now = new Date()
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  return birth <= cutoff
}
