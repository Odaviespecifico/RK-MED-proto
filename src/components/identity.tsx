import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from './ui/button'
import type { PublicPartner as Partner } from '../integrations/contracts'

export function Brand({ dark = false }: { dark?: boolean }) { return <span className={`brand ${dark ? 'brand-dark' : ''}`}><span className="brand-symbol" aria-hidden="true">R</span><span>RK<span className="brand-light">MED</span><small>LINHA GOLD</small></span></span> }
export function Eyebrow({ children }: { children: ReactNode }) { return <span className="eyebrow"><span className="eyebrow-line" />{children}</span> }
export function Gate({ icon, title, detail, action, onAction }: { icon: ReactNode; title: string; detail: string; action: string; onAction: () => void }) { return <div className="gate-page"><Brand /><div className="gate-card" role="main"><div className="gate-icon">{icon}</div><h1>{title}</h1><p>{detail}</p><Button onClick={onAction}>{action}<ArrowRight size={17} /></Button></div></div> }
export function PartnerLogo({ partner }: { partner: Partner }) { return <span className={`partner-logo tone-${partner.tone}`} aria-hidden="true">{partner.initials}</span> }
