import type { Role, WorkSession } from './data'

export type DemoSession = { role: Role; memberId?: string; employee?: string }
export const SESSION_KEY = 'rkmed-prototype-session-v1'
export const WORK_SESSION_KEY = 'rkmed-demo-work-session-v1'
export const loadSession = (): DemoSession | null => {
  try { const saved = localStorage.getItem(SESSION_KEY); return saved ? JSON.parse(saved) as DemoSession : null } catch { return null }
}
export const loadWorkSession = (): WorkSession | null => {
  try {
    const saved = sessionStorage.getItem(WORK_SESSION_KEY)
    const value = saved ? JSON.parse(saved) as Partial<WorkSession> : null
    return value && typeof value.employeeId === 'string' && typeof value.partnerId === 'string' ? { employeeId: value.employeeId, partnerId: value.partnerId } : null
  } catch { return null }
}
