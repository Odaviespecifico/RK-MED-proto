import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, QrCode, MapPin, CreditCard } from 'lucide-react'
import { Brand } from '../../components/identity'
import { Button } from '../../components/ui/button'
import { brl } from '../../lib/format'
import { goldPlan } from '../../lib/member-experience'
import './member-experience.css'

const benefits = [
  { title: 'Seu acesso à rede RKMED', text: 'A RKMED é um clube de benefícios. Você recebe descontos nos estabelecimentos parceiros e paga pelos serviços diretamente a eles.', icon: MapPin },
  { title: 'Seu cartão no celular', text: 'Consulte parceiros, endereços e descontos. Apresente o QR do cartão digital; o parceiro confirma sua assinatura online.', icon: QrCode },
  { title: 'Adesão com contatos verificados', text: `Preencha seus dados, confirme e-mail e celular, adicione a foto e siga para o pagamento. A assinatura ${goldPlan.name} custa ${brl(goldPlan.monthlyCents)} por mês. Os benefícios são liberados após a confirmação do pagamento.`, icon: CreditCard },
]
export function EnrollmentFrame({ children, showIntroduction, go }: { children: ReactNode; showIntroduction: boolean; go: (path: string) => void }) {
  const [slide, setSlide] = useState(0)
  const [skipped, setSkipped] = useState(() => !matchMedia('(max-width: 767px)').matches)
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 767px)').matches)
  const title = useRef<HTMLHeadingElement>(null)
  const content = useRef<HTMLElement>(null)
  useEffect(() => { const query = matchMedia('(max-width: 767px)'); const change = () => setMobile(query.matches); query.addEventListener('change', change); return () => query.removeEventListener('change', change) }, [])
  const introduction = mobile && showIntroduction && !skipped
  useEffect(() => { if (introduction) title.current?.focus() }, [slide, introduction])
  useEffect(() => { if (skipped && !introduction) content.current?.querySelector<HTMLElement>('h2')?.focus() }, [skipped, introduction])
  const current = benefits[slide], Icon = current.icon
  function next() { if (slide < benefits.length - 1) setSlide(slide + 1); else setSkipped(true) }
  return <div className={`enrollment-layout${introduction ? ' enrollment-introduction' : ''}`}>
    <aside className="enrollment-benefits" aria-label="Conheça a RKMED">
      <button className="brand-button" onClick={() => go('/')} aria-label="RKMED — início"><Brand dark /></button>
      <div className="enrollment-benefit-content">
        <span className="enrollment-benefit-icon" aria-hidden="true"><Icon size={28} /></span>
        <p className="enrollment-eyebrow">RKMED · {goldPlan.name}</p>
        <h1 key={current.title} ref={title} tabIndex={-1}>{current.title}</h1><p>{current.text}</p>
        <div className="enrollment-benefit-navigation"><div className="enrollment-dots" aria-label={`Apresentação ${slide + 1} de ${benefits.length}`}>{benefits.map((item, index) => <button key={item.title} aria-label={`Ver apresentação ${index + 1}: ${item.title}`} aria-current={slide === index ? 'step' : undefined} onClick={() => setSlide(index)}><span /></button>)}</div><span className="enrollment-desktop-controls"><Button variant="ghost" aria-label="Benefício anterior" disabled={slide === 0} onClick={() => setSlide(slide - 1)}><ArrowLeft size={18} /></Button><Button variant="ghost" aria-label="Próximo benefício" disabled={slide === benefits.length - 1} onClick={() => setSlide(slide + 1)}><ArrowRight size={18} /></Button></span></div>
        {introduction && <div className="enrollment-intro-actions"><button className="enrollment-touch" onClick={next}>Toque para continuar <ArrowRight size={16} /></button><Button onClick={next}>Continuar <ArrowRight size={18} /></Button><Button variant="ghost" onClick={() => setSkipped(true)}>Pular apresentação</Button></div>}
      </div>
      <p className="enrollment-benefit-foot"><Check size={16} aria-hidden="true" /> Um clube de benefícios para o dia a dia.</p>
    </aside>
    <main ref={content} className="enrollment-main" hidden={introduction}><div className="enrollment-card"><div className="enrollment-mobile-brand"><Brand /></div>{children}</div></main>
  </div>
}
