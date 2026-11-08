import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

// Export the manual checklist without adding a Markdown/PDF dependency.
const source = new URL('../../tests/test.md', import.meta.url)
const output = new URL('../../tests/test.pdf', import.meta.url)
const markdown = await readFile(source, 'utf8')
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function inline(value) {
  const tokens = []
  const protect = html => { tokens.push(html); return `\u0000${tokens.length - 1}\u0000` }
  return escape(value)
    .replace(/`([^`]+)`/g, (_, code) => protect(`<code>${code}</code>`))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => protect(/^https?:\/\//.test(href) ? `<a href="${href}">${label}</a>` : label))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)])
}

const lines = markdown.split('\n')
const blocks = []
let checklistCount = 0
for (let i = 0; i < lines.length;) {
  const line = lines[i]
  if (!line.trim()) { i++; continue }
  if (line.startsWith('```')) {
    const code = []
    i++
    while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
    i++
    blocks.push(`<pre>${escape(code.join('\n'))}</pre>`)
  } else if (/^#{1,6} /.test(line)) {
    const [, hashes, title] = line.match(/^(#+) (.*)$/)
    blocks.push(`<h${hashes.length}>${inline(title)}</h${hashes.length}>`)
    i++
  } else if (line.startsWith('|')) {
    const rows = []
    while (i < lines.length && lines[i].startsWith('|')) {
      const cells = lines[i++].split('|').slice(1, -1).map(cell => cell.trim())
      if (cells.every(cell => /^:?-+:?$/.test(cell))) continue
      rows.push(cells)
    }
    blocks.push(`<table><thead><tr>${rows[0].map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(row => `<tr>${row.map(cell => `<td>${inline(cell) || '<span class="blank">&nbsp;</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
  } else if (line.startsWith('- [ ] ')) {
    checklistCount++
    blocks.push(`<div class="check"><div class="check-copy"><span class="box" aria-hidden="true"></span><div>${inline(line.slice(6))}</div></div><div class="result"><span class="box"></span> Passou <span class="box"></span> Falhou <span class="box"></span> Bloqueado <span class="box"></span> Não se aplica <span class="evidence">Evidência: ____________________</span></div></div>`)
    i++
  } else if (/^\d+\. /.test(line)) {
    const items = []
    while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ''))
    blocks.push(`<ol>${items.map(item => `<li>${inline(item)}</li>`).join('')}</ol>`)
  } else {
    const paragraph = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(?:#|\||```|- \[ \]|\d+\. )/.test(lines[i])) paragraph.push(lines[i++])
    blocks.push(`<p>${inline(paragraph.join(' '))}</p>`)
  }
}

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>RKMED — roteiro de testes</title><style>
@page { size: A4; }
* { box-sizing: border-box; }
body { font: 10pt/1.45 Arial, sans-serif; color: #111; margin: 0; }
h1 { font-size: 23pt; line-height: 1.15; margin: 0 0 8mm; }
h2 { font-size: 15pt; margin: 8mm 0 3mm; border-bottom: 1px solid #555; padding-bottom: 2mm; }
h3 { font-size: 11.5pt; margin: 5mm 0 2mm; }
h1, h2, h3 { break-after: avoid; }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
strong { font-weight: 700; }
a { color: inherit; text-decoration: underline; overflow-wrap: anywhere; }
code { font: 8.5pt/1.4 monospace; overflow-wrap: anywhere; }
pre { font: 8.5pt/1.5 monospace; background: #f3f3f3; border: 1px solid #ccc; padding: 3mm; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0 5mm; table-layout: fixed; font-size: 9pt; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td { border: 1px solid #aaa; padding: 2.3mm; vertical-align: top; overflow-wrap: anywhere; }
th { text-align: left; background: #ededed; }
td:has(.blank) { height: 10mm; }
ol { padding-left: 6mm; margin: 2mm 0 4mm; }
li { margin-bottom: 2mm; break-inside: avoid; }
.check { break-inside: avoid; padding: 2mm 0 3mm; margin-bottom: 2mm; border-bottom: 1px solid #ccc; }
.check-copy { display: flex; gap: 2.5mm; align-items: baseline; }
.box { display: inline-block; flex-shrink: 0; width: 3.2mm; height: 3.2mm; border: 1px solid #222; vertical-align: -0.3mm; background: white; }
.result { font-size: 8pt; margin: 2.5mm 0 0 5.7mm; display: flex; gap: 1.5mm; align-items: center; flex-wrap: wrap; }
.evidence { margin-left: 2mm; }
.notes { break-before: page; }
.note-row { height: 11mm; border-bottom: 1px solid #aaa; }
.print-note { border: 1px solid #888; padding: 3mm; margin-bottom: 6mm; font-size: 9pt; }
</style></head><body><div class="print-note"><strong>Ficha de execução manual · formato A4</strong><br>Marque o resultado em cada item e anote a evidência. Caixas vazias não significam aprovação. Use as páginas finais para registrar falhas e observações. Comandos devem ser executados a partir da raiz do projeto.</div>${blocks.join('\n')}<section class="notes"><h2>Registro de falhas e observações</h2><p>Responsável: __________________________________ Data: ____ / ____ / ______</p><p>Cenário / resultado / esperado × observado / evidência:</p>${'<div class="note-row"></div>'.repeat(19)}</section><section class="notes"><h2>Parecer da rodada</h2><p>Ambiente / versão: __________________________________________________</p><p>Passaram: ______ Falharam: ______ Bloqueados: ______ Não se aplicam: ______</p><p>Decisão e pendências (identificar cenários e responsáveis):</p>${'<div class="note-row"></div>'.repeat(12)}<p style="margin-top:8mm">Responsável: __________________________ Assinatura: ____________________</p></section></body></html>`

await mkdir(new URL('../../tests/', import.meta.url), { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: fileURLToPath(output), format: 'A4', printBackground: true, displayHeaderFooter: true,
    margin: { top: '17mm', right: '16mm', bottom: '18mm', left: '16mm' },
    headerTemplate: '<div style="font:8px Arial;width:100%;margin:0 16mm;color:#555">RKMED · Roteiro de testes manuais</div>',
    footerTemplate: '<div style="font:9px Arial;width:100%;margin:0 16mm;display:flex;justify-content:space-between;color:#555"><span>Resultado por item + registro de evidências</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>' })
  await page.screenshot({ path: '/tmp/rkmed-test-print.png', fullPage: false })
  console.log(`PDF gerado: tests/test.pdf (${checklistCount} itens de checklist).`)
} finally { await browser.close() }
