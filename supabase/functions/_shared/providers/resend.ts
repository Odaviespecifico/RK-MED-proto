type Environment = Record<string, string | undefined>

const palette = { deep: '#17231d', ink: '#1b2923', gold: '#c0a16d', sand: '#e6dfcf', paper: '#ffffff', muted: '#58675b', line: '#e9ebe6', bg: '#f7f7f4' }

function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return value.replace(/[&<>"']/g, char => entities[char]!)
}

function paragraphs(text: string) {
  return text.split(/\n{2,}/).map(block =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${palette.muted};">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('')
}

function layout(subject: string, content: string, preheader: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${palette.bg};font-family:Arial,Helvetica,sans-serif;color:${palette.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${palette.bg};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${palette.paper};border:1px solid ${palette.sand};border-radius:18px;overflow:hidden;">
<tr><td style="background:${palette.deep};padding:26px 32px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;letter-spacing:-0.5px;color:#f5efe2;">RKMED</div>
<div style="margin-top:4px;font-size:10px;letter-spacing:3px;font-weight:700;color:${palette.gold};">LINHA GOLD</div>
</td></tr>
<tr><td style="padding:36px 32px 8px;">${content}</td></tr>
<tr><td style="padding:24px 32px 32px;">
<div style="border-top:1px solid ${palette.line};padding-top:18px;font-size:12px;line-height:1.6;color:#8a948c;">RKMED · Linha Gold · Carpina, PE<br>Este é um e-mail automático de segurança. Não responda.</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function codeContent(subject: string, code: string) {
  return `<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:700;color:${palette.ink};">${escapeHtml(subject)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${palette.muted};">Use o código abaixo para confirmar seu acesso à RKMED. Ele é válido por <strong style="color:${palette.ink};">5 minutos</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${palette.bg};border:1px solid ${palette.sand};border-radius:14px;">
<tr><td align="center" style="padding:24px 16px;">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:#947144;margin-bottom:12px;">Código de verificação</div>
<div style="font-family:'Courier New',Courier,monospace;font-size:40px;line-height:1;letter-spacing:10px;font-weight:700;color:${palette.deep};">${escapeHtml(code)}</div>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:${palette.muted};">Não compartilhe este código. Se você não solicitou, ignore esta mensagem.</p>`
}

export function createResendSandbox(env: Environment, transport: typeof fetch = fetch) {
  return {
    async send(to: string, subject: string, text: string, operation: string, code?: string) {
      const allowed = (env.RESEND_ALLOWED_TEST_EMAILS || '').split(',').map(email => email.trim().toLowerCase())
      if (!['local', 'sandbox'].includes(env.APP_ENV || '') || env.RESEND_MODE !== 'transactional-sandbox'
        || !env.RESEND_API_KEY || !env.RESEND_FROM || (!allowed.includes('*') && !allowed.includes(to.toLowerCase())) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Entrega de e-mail de teste não configurada ou destinatário não autorizado.')
      const from = env.RESEND_FROM.includes('<') ? env.RESEND_FROM : `RKMED <${env.RESEND_FROM}>`
      const html = code
        ? layout(subject, codeContent(subject, code), text)
        : layout(subject, `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:700;color:${palette.ink};">${escapeHtml(subject)}</h1>${paragraphs(text)}`, text)
      const result = await transport('https://api.resend.com/emails', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `rkmed/${operation}` },
        body: JSON.stringify({ from, to: [to], subject, text, html }) })
      if (!result.ok) throw new Error('Entrega de e-mail recusada. Verifique a configuração do sandbox.')
    },
  }
}
