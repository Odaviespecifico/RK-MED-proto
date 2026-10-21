import { useEffect, useState } from 'react'
import type { CursorPage, PageCursor } from './pagination'

export function useCursorPage<T>(load: (cursor: PageCursor | null) => Promise<CursorPage<T>>, enabled: boolean, revision = 0) {
  const [cursors, setCursors] = useState<(PageCursor | null)[]>([null])
  const [index, setIndex] = useState(0)
  const [epoch, setEpoch] = useState(0)
  const [response, setResponse] = useState<{ key: string; value: CursorPage<T> | null; error: string } | null>(null)
  // A changed loader (filters/account) starts a new traversal, without reusing old cursors.
  const [identity, setIdentity] = useState(() => load)
  const [seenRevision, setSeenRevision] = useState(revision)
  if (identity !== load || seenRevision !== revision) {
    setIdentity(() => load); setSeenRevision(revision); setCursors([null]); setIndex(0); setEpoch(value => value + 1); setResponse(null)
  }
  const key = `${epoch}:${index}`
  useEffect(() => {
    if (!enabled) return
    let active = true
    load(cursors[index]).then(value => { if (active) setResponse({ key, value, error: '' }) })
      .catch(error => { if (active) setResponse({ key, value: null, error: error instanceof Error ? error.message : 'Não foi possível carregar a página.' }) })
    return () => { active = false }
  }, [load, enabled, key])
  const current = response?.key === key ? response : null
  const data = enabled ? current?.value || null : null
  const loading = enabled && !current
  return {
    data, loading, error: enabled ? current?.error || '' : '', number: index + 1,
    canPrevious: index > 0, canNext: !!data?.hasMore,
    next() { if (!loading && data?.nextCursor) { setCursors([...cursors.slice(0, index + 1), data.nextCursor]); setIndex(index + 1) } },
    previous() { if (!loading && index > 0) setIndex(index - 1) },
    refresh() { setCursors([null]); setIndex(0); setEpoch(value => value + 1); setResponse(null) },
  }
}
