import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from './ui/pagination'

export function PageControls({ label, page }: { label: string; page: { number: number; totalPages?: number; loading: boolean; canPrevious: boolean; canNext: boolean; previous: () => void; next: () => void } }) {
  return <Pagination aria-label={label} aria-busy={page.loading}>
    <PaginationContent>
      <PaginationItem><PaginationPrevious disabled={page.loading || !page.canPrevious} onClick={page.previous} /></PaginationItem>
      <PaginationItem className="pagination-current"><span aria-live="polite" aria-current="page">Página {page.number}{page.totalPages ? ` de ${page.totalPages}` : ''}</span></PaginationItem>
      <PaginationItem><PaginationNext disabled={page.loading || !page.canNext} onClick={page.next} /></PaginationItem>
    </PaginationContent>
  </Pagination>
}
