import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="admin-empty-state"><span className="admin-empty-icon" aria-hidden="true"><Icon size={21} /></span><div><strong>{title}</strong><p>{description}</p></div></div>
}
