import { Download, FileSpreadsheet, FileText } from 'lucide-react'

type ExportValue = string | number | null | undefined
export type ExportColumn<Row> = { label: string; value: (row: Row) => ExportValue }

function csvCell(value: ExportValue) {
  let text = value == null ? '' : String(value)
  if (/^[=+@\-]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function escapeHtml(value: ExportValue) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

function fileName(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}`
}

export function exportCsv<Row>(title: string, columns: ExportColumn<Row>[], rows: Row[]) {
  const lines = [columns.map((column) => csvCell(column.label)).join(','), ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(','))]
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName(title)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function exportPdf<Row>(title: string, columns: ExportColumn<Row>[], rows: Row[]) {
  const printWindow = window.open('', '_blank', 'width=1100,height=800')
  if (!printWindow) {
    window.alert('Allow pop-ups to create the print-ready PDF view.')
    return
  }
  printWindow.opener = null
  const header = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`).join('')
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4 landscape;margin:14mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172033;margin:0}header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #f45b22}h1{font-size:20px;margin:0 0 5px}p{margin:0;color:#64748b;font-size:11px}table{border-collapse:collapse;width:100%}th{background:#eef2f6;text-align:left;font-weight:700}th,td{border:1px solid #dbe2ea;padding:8px;vertical-align:top}tr:nth-child(even){background:#f8fafc}footer{margin-top:12px;text-align:right;color:#64748b;font-size:10px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><header><div><h1>${escapeHtml(title)}</h1><p>Toggar ERP · Generated ${escapeHtml(new Date().toLocaleString())}</p></div><p>${rows.length} records</p></header><table><thead><tr>${header}</tr></thead><tbody>${body || `<tr><td colspan="${columns.length}">No records</td></tr>`}</tbody></table><footer>Use your browser's print dialog and choose “Save to PDF”.</footer><script>window.onload=()=>{window.print()}</script></body></html>`)
  printWindow.document.close()
}

export function ExportActions<Row>({ title, columns, rows }: { title: string; columns: ExportColumn<Row>[]; rows: Row[] }) {
  const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent'
  return <div className="flex flex-wrap gap-2">
    <button type="button" className={buttonClass} onClick={() => exportPdf(title, columns, rows)}><FileText className="h-4 w-4 text-primary" />PDF</button>
    <button type="button" className={buttonClass} onClick={() => exportCsv(title, columns, rows)}><FileSpreadsheet className="h-4 w-4 text-emerald-600" />Excel CSV<Download className="hidden h-3.5 w-3.5 sm:block" /></button>
  </div>
}
