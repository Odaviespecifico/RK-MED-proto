import { Button } from './ui/button'

export function PageControls({ label, page }: { label: string; page: { number: number; loading: boolean; canPrevious: boolean; canNext: boolean; previous: () => void; next: () => void } }) {
  return <nav className="row-actions" aria-label={label}>
    <Button variant="outline" disabled={page.loading || !page.canPrevious} onClick={page.previous}>Página anterior</Button>
    <span aria-live="polite">Página {page.number}</span>
    <Button variant="outline" disabled={page.loading || !page.canNext} onClick={page.next}>Próxima página</Button>
  </nav>
}
