import { useCallback, useEffect, useMemo, useState } from 'react'

export function clientPageBounds(totalItems: number, pageSize: number, requestedPage: number) {
  const safeSize = Math.max(1, Math.floor(pageSize))
  const safeTotal = Math.max(0, Math.floor(totalItems))
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize))
  const number = Math.min(Math.max(1, Math.floor(requestedPage)), totalPages)
  const startIndex = (number - 1) * safeSize
  const endIndex = Math.min(safeTotal, startIndex + safeSize)
  return { number, totalPages, startIndex, endIndex, start: safeTotal ? startIndex + 1 : 0, end: endIndex }
}

export function clientPageSlice<T>(items: readonly T[], pageSize: number, requestedPage: number) {
  const bounds = clientPageBounds(items.length, pageSize, requestedPage)
  return { ...bounds, items: items.slice(bounds.startIndex, bounds.endIndex) }
}

export function nextAutoPage(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return 1
  return currentPage >= totalPages ? 1 : currentPage + 1
}

export function useClientPage<T>(items: readonly T[], pageSize: number, options?: { autoAdvanceMs?: number; paused?: boolean; resetKey?: string | number }) {
  const [requested, setRequested] = useState(1)
  const autoAdvanceMs = options?.autoAdvanceMs ?? 0
  const paused = options?.paused ?? false
  const resetKey = options?.resetKey

  useEffect(() => {
    setRequested(1)
  }, [resetKey])

  const page = useMemo(() => clientPageSlice(items, pageSize, requested), [items, pageSize, requested])

  useEffect(() => {
    if (requested !== page.number) setRequested(page.number)
  }, [requested, page.number])

  useEffect(() => {
    if (autoAdvanceMs <= 0 || page.totalPages <= 1 || paused) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      setRequested(current => nextAutoPage(current, page.totalPages))
    }, autoAdvanceMs)
    return () => window.clearInterval(timer)
  }, [autoAdvanceMs, page.totalPages, paused])

  const previous = useCallback(() => setRequested(current => Math.max(1, current - 1)), [])
  const next = useCallback(() => setRequested(current => Math.min(page.totalPages, current + 1)), [page.totalPages])
  const goTo = useCallback((target: number) => setRequested(Math.min(Math.max(1, Math.floor(target)), page.totalPages)), [page.totalPages])

  return {
    items: page.items,
    number: page.number,
    totalPages: page.totalPages,
    totalItems: items.length,
    start: page.start,
    end: page.end,
    loading: false,
    canPrevious: page.number > 1,
    canNext: page.number < page.totalPages,
    previous,
    next,
    goTo,
  }
}
