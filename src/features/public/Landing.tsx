import { PartnerLocation } from '../../components/PartnerLocation'
import { useEffect, useRef } from 'react'
import { ArrowUpRight, ArrowRight, ArrowDownRight, Menu, Heart, BadgeCheck, Smartphone, MapPin, ChevronDown, UserRound, QrCode } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Brand, Eyebrow, PartnerLogo } from '../../components/identity'
import { PartnerMap } from '../../PartnerMap'
import { brl } from '../../lib/format'
import type { PublicPartner } from '../../integrations/contracts'

function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    section.classList.add('journey-motion')
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.18, rootMargin: '0px 0px -30px 0px' })
    section.querySelectorAll('.journey-reveal').forEach(element => observer.observe(element))
    return () => { observer.disconnect(); section.classList.remove('journey-motion') }
  }, [])

  const steps = [
    { icon: <UserRound size={23} />, number: '01', title: 'Cadastre-se', text: 'Confirme seus contatos e adicione uma foto para o cartão.' },
    { icon: <MapPin size={23} />, number: '02', title: 'Encontre um parceiro', text: 'Consulte endereço, categoria e percentual de desconto.' },
    { icon: <QrCode size={23} />, number: '03', title: 'Mostre o cartão', text: 'O parceiro valida seu QR e confirma o valor com desconto.' },
  ]

  return <section id="como-funciona" className="section shell how-section" ref={sectionRef} aria-labelledby="how-title">
    <div className="journey-layout">
      <div className="journey-intro journey-reveal">
        <Eyebrow>COMO FUNCIONA</Eyebrow>
        <h2 id="how-title">Do cadastro<br /><em>ao desconto.</em></h2>
        <p>Cadastre-se, escolha um parceiro e apresente o cartão digital na compra.</p>
      </div>
      <div className="journey-stack">
        {steps.map(step => <article className="journey-step journey-reveal" key={step.number}>
          <span className="journey-number" aria-hidden="true">{step.number}</span>
          <div className="journey-step-copy"><h3>{step.title}</h3><p>{step.text}</p></div>
          <span className="journey-icon" aria-hidden="true">{step.icon}</span>
        </article>)}
      </div>
    </div>
  </section>
}
export function Landing({ data, go, menuOpen, setMenuOpen, partnersLoading = false, partnersError = '' }: { data: { partners: PublicPartner[] }; go: (p: string) => void; menuOpen: boolean; setMenuOpen: (open: boolean) => void; partnersLoading?: boolean; partnersError?: string }) {
  return <div className="landing">
    <header className="public-header"><div className="public-nav shell"><button className="brand-button" onClick={() => go('/')}><Brand /></button><nav id="public-navigation" aria-label="Navegação principal" className={menuOpen ? 'public-links open' : 'public-links'}><a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</a><a href="#parceiros" onClick={() => setMenuOpen(false)}>Parceiros</a><a href="#beneficios" onClick={() => setMenuOpen(false)}>Benefícios</a></nav><div className="public-actions"><Button variant="ghost" onClick={() => go('/entrar')}>Entrar</Button><Button onClick={() => go('/cadastro')}>Quero fazer parte <ArrowUpRight size={16} /></Button></div><button className="mobile-menu" onClick={() => { const opening = !menuOpen; setMenuOpen(opening); if (opening) window.requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>('#public-navigation a')?.focus()) }} aria-controls="public-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}><Menu /></button></div></header>
    <main><section className="hero shell"><div className="hero-copy"><Eyebrow>LINHA GOLD · CARPINA, PE</Eyebrow><h1>Descontos para<br />cuidar da saúde<br /><em>no dia a dia.</em></h1><p>Use seu cartão digital em laboratórios, academias e lojas de suplementos participantes. Assinatura de {brl(6990)} por mês.</p><div className="hero-actions"><Button onClick={() => go('/cadastro')}>Começar cadastro <ArrowRight size={18} /></Button><button className="text-button" onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}>Como funciona <ArrowDownRight size={17} /></button></div><p className="hero-proof">Apresente o QR no balcão. O parceiro confirma sua assinatura online.</p></div><div className="hero-art"><div className="hero-card"><span className="card-top">RKMED <small>LINHA GOLD</small></span><span className="hero-card-slogan">Seu cartão para acessar os benefícios da rede.</span><span className="hero-card-bottom">CARTÃO DIGITAL <span>CARPINA · PE</span></span></div><div className="hero-art-caption">CARTÃO DIGITAL LINHA GOLD</div></div></section>
    <div className="benefit-strip"><div className="shell strip-grid"><div><Heart size={22} /><span><b>Até 20% de desconto</b><small>Conforme o parceiro</small></span></div><div><BadgeCheck size={22} /><span><b>Rede em Carpina</b><small>Endereços no mapa</small></span></div><div><Smartphone size={22} /><span><b>Cartão digital</b><small>QR disponível offline</small></span></div></div></div>
    <HowItWorks />
    <section id="parceiros" className="partners-section"><div className="shell section"><div className="section-header"><div><Eyebrow>REDE DE PARCEIROS</Eyebrow><h2>Parceiros<br /><em>e endereços.</em></h2></div><p>Consulte as categorias, os descontos e os endereços dos parceiros no mapa.</p></div><div className="partner-grid">{partnersLoading ? <p role="status">Carregando parceiros…</p> : partnersError ? <p role="alert">{partnersError}</p> : data.partners.length === 0 ? <p>Nenhum parceiro disponível no momento.</p> : null}{data.partners.map(p => <article className="partner-card" key={p.id}><div className={`partner-card-art tone-${p.tone}`}><span className="partner-art-circle" /><PartnerLogo partner={p} /><span className="partner-percent">{p.discount}% OFF</span></div><div className="partner-card-content"><small>{p.segment.toUpperCase()}</small><h3>{p.name}</h3><p><MapPin size={15} />{p.address}</p><PartnerLocation partner={p} /></div></article>)}</div><PartnerMap partners={data.partners} /></div></section>
    <section id="beneficios" className="membership-section shell"><div className="membership-copy"><Eyebrow>ASSINATURA LINHA GOLD</Eyebrow><h2>Um cartão.<br /><em>Vários descontos.</em></h2><p>O cartão fica disponível no celular, inclusive offline. Para usar o desconto, o estabelecimento precisa validar a assinatura online.</p><div className="price"><strong>R$ 69,90</strong><span>/ mês</span></div><Button onClick={() => go('/cadastro')}>Quero ser associado <ArrowRight size={17} /></Button></div><div className="membership-graphic"><div className="member-mini"><div className="mini-top"><Brand dark /></div><div className="mini-center">Seu acesso à rede de benefícios.</div><div className="mini-bottom">MEMBRO GOLD <span>2026</span></div></div></div></section>
    <section className="faq-section shell"><div><Eyebrow>AINDA TEM DÚVIDAS?</Eyebrow><h2>Perguntas frequentes</h2></div><div className="faq-items"><details><summary>Já tenho plano de saúde. Faz sentido para mim?<ChevronDown size={18} /></summary><p>O RKMED é um clube de benefícios independente. Você pode usar os descontos oferecidos pelos parceiros credenciados.</p></details><details><summary>Como uso meu benefício?<ChevronDown size={18} /></summary><p>Apresente seu cartão digital ao parceiro. Ele confirma sua foto e sua assinatura online antes de registrar a compra.</p></details><details><summary>Meu cartão funciona sem internet?<ChevronDown size={18} /></summary><p>Você pode mostrar o cartão salvo offline. O estabelecimento precisa de internet para validar sua situação no momento da compra.</p></details></div></section></main>
    <footer className="footer"><div className="shell footer-content"><Brand dark /><p>Clube de benefícios em saúde e bem-estar.</p><div><button onClick={() => go('/termos')}>Termos de uso</button><button onClick={() => go('/privacidade')}>Privacidade</button><button onClick={() => go('/acesso-parceiro')}>Parceiro</button><button onClick={() => go('/acesso-admin')}>Equipe RK</button></div><small>© {new Date().getFullYear()} RKMED</small></div></footer>
  </div>
}

