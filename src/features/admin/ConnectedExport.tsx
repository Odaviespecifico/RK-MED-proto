import { useState } from 'react'
import { Download, FileSpreadsheet, Landmark, Store, Users } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { Portal } from '../../integrations/portal'
import { buildDatasetCsv, defaultSelectedFields, EXPORT_COLUMNS, EXPORT_DATASETS, periodRange, type ExportDataset } from '../../lib/data-export'

const DATASET_ORDER: ExportDataset[] = ['partners', 'members', 'financial']

const DATASET_ICONS = {
  partners: Store,
  members: Users,
  financial: Landmark,
} as const

export function ConnectedExport({ api, online }: { api: Portal; online: boolean }) {
  const initialPeriod = periodRange('month')
  const [dataset, setDataset] = useState<ExportDataset>('partners')
  const [from, setFrom] = useState(initialPeriod.from)
  const [to, setTo] = useState(initialPeriod.to)
  const [fieldsByDataset, setFieldsByDataset] = useState<Record<ExportDataset, string[]>>({
    partners: defaultSelectedFields('partners'),
    members: defaultSelectedFields('members'),
    financial: defaultSelectedFields('financial'),
  })
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const meta = EXPORT_DATASETS[dataset]
  const columns = EXPORT_COLUMNS[dataset]
  const selected = fieldsByDataset[dataset]

  function switchDataset(next: ExportDataset) {
    setDataset(next); setConfirm(false); setError(''); setNotice('')
  }

  function toggleField(key: string) {
    setConfirm(false); setError(''); setNotice('')
    setFieldsByDataset(current => {
      const list = current[dataset]
      const updated = list.includes(key) ? list.filter(item => item !== key) : [...list, key]
      return { ...current, [dataset]: updated }
    })
  }

  function setFields(keys: string[]) {
    setConfirm(false); setError(''); setNotice('')
    setFieldsByDataset(current => ({ ...current, [dataset]: keys }))
  }

  function applyPreset(preset: 'month' | '30d' | '90d' | '365d') {
    const next = periodRange(preset)
    setFrom(next.from); setTo(next.to); setConfirm(false); setError(''); setNotice('')
  }

  function openConfirm(event: React.FormEvent) {
    event.preventDefault()
    setError(''); setNotice('')
    if (!from || !to) { setError('Informe a data inicial e a data final.'); return }
    if (from > to) { setError('A data inicial não pode ser posterior à data final.'); return }
    if (!selected.length) { setError('Selecione ao menos um campo para incluir na planilha.'); return }
    setConfirm(true)
  }

  async function download() {
    if (!online || busy || !selected.length) return
    setBusy(true); setError(''); setNotice('')
    try {
      const payload = await api.exportData(dataset, from, to)
      const csv = buildDatasetCsv(dataset, payload.rows, selected)
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${meta.filePrefix}-${payload.from}-${payload.to}.csv`
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice(`Planilha CSV gerada com ${payload.rows.length} registro(s) e ${selected.length} coluna(s). A exportação foi auditada.`)
      setConfirm(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível exportar os dados.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="surface-card counter-flow export-panel">
    <div>
      <h2>Exportar planilha CSV</h2>
      <p className="billing-subtitle">Escolha o tipo de dado, o período e exatamente quais colunas entram na planilha. CPFs são sempre mascarados e a exportação é auditada (limite de 5.000 registros por arquivo).</p>
    </div>

    <div className="export-dataset-grid" role="radiogroup" aria-label="Tipo de dado para exportar">
      {DATASET_ORDER.map(item => {
        const Icon = DATASET_ICONS[item]
        const info = EXPORT_DATASETS[item]
        const active = dataset === item
        return <button key={item} type="button" role="radio" aria-checked={active} className={active ? 'export-dataset-card selected' : 'export-dataset-card'} disabled={busy} onClick={() => switchDataset(item)}>
          <span className="export-dataset-head"><Icon size={18} aria-hidden="true" /><strong>{info.label}</strong></span>
          <small>{info.description}</small>
        </button>
      })}
    </div>

    <form className="counter-flow" onSubmit={openConfirm}>
      <div className="export-period-section">
        <div className="small-section-head">
          <h3>Período</h3>
          <div className="export-presets">
            <button type="button" disabled={busy} onClick={() => applyPreset('month')}>Este mês</button>
            <button type="button" disabled={busy} onClick={() => applyPreset('30d')}>30 dias</button>
            <button type="button" disabled={busy} onClick={() => applyPreset('90d')}>90 dias</button>
            <button type="button" disabled={busy} onClick={() => applyPreset('365d')}>1 ano</button>
          </div>
        </div>
        <p className="billing-subtitle">{meta.periodNote}</p>
        <div className="export-dates-row">
          <label className="field-label">Data inicial<input className="input" type="date" required value={from} disabled={busy} onChange={e => { setFrom(e.target.value); setConfirm(false) }} /></label>
          <label className="field-label">Data final<input className="input" type="date" required value={to} disabled={busy} onChange={e => { setTo(e.target.value); setConfirm(false) }} /></label>
        </div>
      </div>

      <fieldset className="export-fields-fieldset">
        <div className="small-section-head">
          <legend>Campos da planilha ({selected.length} de {columns.length})</legend>
          <div className="export-presets">
            <button type="button" disabled={busy} onClick={() => setFields(columns.map(column => column.key))}>Todos</button>
            <button type="button" disabled={busy} onClick={() => setFields(defaultSelectedFields(dataset))}>Padrão</button>
            <button type="button" disabled={busy} onClick={() => setFields([])}>Limpar</button>
          </div>
        </div>
        <div className="export-fields-grid">
          {columns.map(column => <label key={column.key} className={selected.includes(column.key) ? 'export-field-chip selected' : 'export-field-chip'}>
            <input type="checkbox" checked={selected.includes(column.key)} disabled={busy} onChange={() => toggleField(column.key)} />
            <span>{column.label}</span>
          </label>)}
        </div>
      </fieldset>

      {error && <p role="alert" className="inline-error">{error}</p>}
      {notice && <p role="status" className="inline-success">{notice}</p>}

      {!confirm ? <div className="row-actions">
        <Button type="submit" disabled={busy || !online || !selected.length}><FileSpreadsheet size={16} aria-hidden="true" /> Preparar exportação CSV</Button>
      </div> : <div className="export-confirm-box" role="region" aria-label="Confirmar exportação de dados">
        <p>Exportar <strong>{meta.label}</strong> de <strong>{from}</strong> a <strong>{to}</strong> com <strong>{selected.length} campo(s)</strong>? O arquivo CSV usa separador ponto e vírgula (padrão Excel Brasil), mantém CPFs mascarados e registra auditoria.</p>
        <div className="row-actions">
          <Button type="button" disabled={busy || !online} onClick={() => void download()}><Download size={16} aria-hidden="true" /> {busy ? 'Gerando planilha…' : 'Confirmar e baixar CSV'}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>Cancelar</Button>
        </div>
      </div>}
    </form>
  </section>
}
