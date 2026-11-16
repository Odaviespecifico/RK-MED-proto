import type { ComponentProps } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

// shadcn/ui pagination composition, adapted to cursor actions with native buttons.
export function Pagination({ className, ...props }: ComponentProps<'nav'>) {
  return <nav aria-label="Paginação" data-slot="pagination" className={cn('pagination', className)} {...props} />
}

export function PaginationContent({ className, ...props }: ComponentProps<'ul'>) {
  return <ul data-slot="pagination-content" className={cn('pagination-content', className)} {...props} />
}

export function PaginationItem({ className, ...props }: ComponentProps<'li'>) {
  return <li data-slot="pagination-item" className={className} {...props} />
}

export function PaginationPrevious(props: ComponentProps<typeof Button>) {
  return <Button type="button" variant="outline" aria-label="Página anterior" {...props}><ChevronLeft size={16} aria-hidden="true" /><span>Anterior</span></Button>
}

export function PaginationNext(props: ComponentProps<typeof Button>) {
  return <Button type="button" variant="outline" aria-label="Próxima página" {...props}><span>Próxima</span><ChevronRight size={16} aria-hidden="true" /></Button>
}
