import { ChevronLeft, ChevronRight } from 'lucide-react'

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-2">
      <span>Rows per page</span>
      <select aria-label="Rows per page" value={pageSize} onChange={(event) => onPageSizeChange?.(Number(event.target.value))} className="min-h-9 rounded-lg border bg-background px-2 text-foreground" disabled={!onPageSizeChange}>
        {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
      <span>{start}–{end} of {total}</span>
    </div>
    <div className="flex items-center justify-between gap-2 sm:justify-end">
      <span>Page {page} of {pageCount}</span>
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-foreground disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
      <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-foreground disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
    </div>
  </div>
}

export function useClientPagination<T>(rows: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  return { rows: rows.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage }
}
