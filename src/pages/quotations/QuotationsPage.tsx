import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, FileText, UserPlus, X, Pencil, Trash2, Download, CircleAlert, ChevronDown, Loader2, Eye, RotateCcw, CheckCircle2, Package } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, formatCustomerName, formatReferenceNumber } from '@/lib/utils'
import { ExportActions } from '@/components/common/ExportActions'
import { Pagination, useClientPagination } from '@/components/common/Pagination'

async function downloadQuotationPdf(id: string, number?: string) {
  const response: any = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' })
  const blob = response instanceof Blob ? response : new Blob([response], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${number || 'quotation'}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function QuotationsPage() {
  const [search, setSearch] = useState('')
  const [quotationFilter, setQuotationFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [generatingPdfIds, setGeneratingPdfIds] = useState<Set<string>>(() => new Set())
  const [viewingQuoteId, setViewingQuoteId] = useState<string | null>(null)
  const [confirmingQuote, setConfirmingQuote] = useState<any | null>(null)
  const [confirmError, setConfirmError] = useState('')
  const [receivedPayment, setReceivedPayment] = useState('')
  const [initialPaymentMethod, setInitialPaymentMethod] = useState('bank_transfer')
  const [initialPaymentReceipt, setInitialPaymentReceipt] = useState<File | null>(null)
  const [invoiceDueDate, setInvoiceDueDate] = useState(() => addDaysToDate(formatLocalDate(new Date()), 30))
  const invoiceTotalForConfirmation = Number(confirmingQuote?.grandTotal || 0)
  const invoiceDueDateMinimum = minimumInvoiceDueDate(confirmingQuote)
  const invoiceDueDateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(invoiceDueDate) && invoiceDueDate >= invoiceDueDateMinimum
  const receivedPaymentValue = Number(receivedPayment)
  const validReceivedPayment = Number.isFinite(receivedPaymentValue) && receivedPaymentValue >= 0 && receivedPaymentValue <= invoiceTotalForConfirmation
  const { data, isLoading, isError } = useQuery({ queryKey: ['quotations', search], queryFn: () => api.get(`/quotations?limit=200&search=${encodeURIComponent(search)}`) as any })
  const quotes = (data as any)?.data?.data ?? []
  const quotationPreviewQuery = useQuery({ queryKey: ['quotation-preview', viewingQuoteId], queryFn: () => api.get(`/quotations/${viewingQuoteId}`) as any, enabled: !!viewingQuoteId })
  const invoiceStockQuery = useQuery({ queryKey: ['quotation-invoice-stock-check', confirmingQuote?.id], queryFn: () => api.get(`/invoices/from-quotation/${confirmingQuote?.id}/stock-check`) as any, enabled: !!confirmingQuote, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true })
  const invoiceStockCheck = (invoiceStockQuery.data as any)?.data ?? invoiceStockQuery.data
  const quotationPreview = (quotationPreviewQuery.data as any)?.data ?? quotationPreviewQuery.data
  const savedVatBreakdown = getQuotationVatBreakdown(quotationPreview)
  const previewAdditionalCharges = [...(quotationPreview?.labourCharges || []).map((charge: any) => ({ ...charge, lineTotal: charge.lineTotal })), ...(quotationPreview?.additionalCharges || [])]
  const normalizedQuotationStatus = (status: string) => ['sent', 'viewed'].includes(status) ? 'open' : status
  const quotationStatusLabel = (status: string) => {
    const normalized = normalizedQuotationStatus(String(status || ''))
    if (normalized === 'accepted') return 'Confirmed'
    return normalized ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—'
  }
  const quotationStatusStyle = (status: string) => {
    const normalized = normalizedQuotationStatus(String(status || '')).toLowerCase()
    if (normalized === 'accepted') return 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-950/5'
    if (normalized === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-800 shadow-rose-950/5'
    if (normalized === 'open') return 'border-sky-200 bg-sky-50 text-sky-800 shadow-sky-950/5'
    return 'border-slate-200 bg-slate-50 text-slate-700 shadow-slate-950/5'
  }
  const customers = useMemo(() => [...new Map(quotes.map((quote: any) => [String(quote.customerId || quote.customer?.id), quote.customer]).filter(([id, customer]: any) => id !== 'undefined' && customer?.id)).values()] as any[], [quotes])
  const visibleQuotes = quotes.filter((quote: any) => {
    const total = Number(quote.grandTotal || 0)
    const quotationDate = String(quote.quotationDate || '').slice(0, 10)
    return (!quotationFilter.trim() || String(quote.quotationNumber || '').toLowerCase().includes(quotationFilter.trim().toLowerCase()))
      && (customerFilter === 'all' || String(quote.customerId || quote.customer?.id) === customerFilter)
      && (statusFilter === 'all' || normalizedQuotationStatus(quote.status) === statusFilter)
      && (!dateFrom || quotationDate >= dateFrom)
      && (!dateTo || quotationDate <= dateTo)
      && (!priceMin || total >= Number(priceMin))
      && (!priceMax || total <= Number(priceMax))
  })
  const paginatedQuotes = useClientPagination(visibleQuotes, page, pageSize)
  const resetFilters = () => {
    setSearch('')
    setQuotationFilter('')
    setCustomerFilter('all')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
    setPriceMin('')
    setPriceMax('')
    setPage(1)
  }
  const deleteQuotation = useMutation({
    mutationFn: (quote: any) => api.delete(`/quotations/${quote.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quotations'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
    },
    onError: (error) => window.alert((error as Error).message || 'Could not delete this quotation.'),
  })
  const confirmQuotation = useMutation({
    mutationFn: () => {
      if (invoiceStockCheck?.canProceed === false) {
        const shortages = (invoiceStockCheck.items || []).filter((item: any) => item.stockable && Number(item.shortage) > 0)
          .map((item: any) => `${item.name}: need ${Number(item.quantity).toLocaleString()}, only ${Number(item.available).toLocaleString()} available (short by ${Number(item.shortage).toLocaleString()})`)
        throw new Error(`Invoice not created because there is not enough stock${shortages.length ? ` — ${shortages.join('; ')}` : '.'}`)
      }
      setConfirmError('')
      const payload = new FormData()
      payload.append('dueDate', invoiceDueDate)
      payload.append('receivedPayment', String(Number(receivedPayment || 0)))
      payload.append('paymentMethod', initialPaymentMethod)
      if (Number(receivedPayment || 0) > 0 && initialPaymentReceipt) payload.append('paymentReceipt', initialPaymentReceipt)
      return api.post(`/invoices/from-quotation/${confirmingQuote.id}`, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quotations'] })
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-balances'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stock'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      void queryClient.invalidateQueries({ queryKey: ['quotation-invoice-stock-check'] })
      setConfirmingQuote(null)
      setConfirmError('')
      setReceivedPayment('')
      setInitialPaymentReceipt(null)
    },
    onError: (error) => setConfirmError((error as Error).message || 'Could not confirm the quotation or create its invoice.'),
  })
  const changeQuotationStatus = useMutation({
    mutationFn: async ({ quote, status }: { quote: any; status: string }) => {
      return api.patch(`/quotations/${quote.id}/status`, { status })
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['quotations'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
    },
    onError: (error) => window.alert((error as Error).message || 'Could not update quotation status.'),
  })
  const startPdfDownload = useCallback(async (id: string, number?: string) => {
    setGeneratingPdfIds((current) => new Set(current).add(id))
    try {
      await downloadQuotationPdf(id, number)
    } catch (error) {
      window.alert((error as Error).message || 'Could not create quotation PDF.')
    } finally {
      setGeneratingPdfIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }, [])
  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="page-header mb-0"><h1 className="page-title">Quotations</h1><p className="page-description">Create and track customer material quotations.</p></div><div className="flex flex-col gap-2 sm:flex-row"><ExportActions title="Quotations" columns={[{ label: 'Quotation', value: (quote: any) => quote.quotationNumber }, { label: 'Reference number', value: (quote: any) => formatReferenceNumber(quote.referenceNumber) }, { label: 'Customer', value: (quote: any) => formatCustomerName(quote.customer?.companyName || [quote.customer?.firstName, quote.customer?.lastName].filter(Boolean).join(' ')) }, { label: 'Date', value: (quote: any) => quote.quotationDate }, { label: 'Valid until', value: (quote: any) => quote.validUntilDate }, { label: 'Status', value: (quote: any) => quote.status }, { label: 'VAT', value: (quote: any) => quote.applyVat ? 'Yes' : 'No' }, { label: 'Total', value: (quote: any) => Number(quote.grandTotal ?? 0).toFixed(2) }]} rows={visibleQuotes} /><Link to="/quotations/new" className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New quotation</Link></div></div>
    <div className="section-card space-y-3 p-4">
      <div className="relative w-full max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search quotation, reference, or customer..." className="min-h-11 w-full rounded-lg border bg-muted/30 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-muted-foreground">Quotation number<input value={quotationFilter} onChange={(event) => { setQuotationFilter(event.target.value); setPage(1) }} placeholder="e.g. TOG-1001" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <label className="text-xs font-medium text-muted-foreground">Customer<select value={customerFilter} onChange={(event) => { setCustomerFilter(event.target.value); setPage(1) }} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground"><option value="all">All customers</option>{customers.map((customer: any) => <option key={customer.id} value={customer.id}>{formatCustomerName(customer.companyName || [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer')}</option>)}</select></label>
        <label className="text-xs font-medium text-muted-foreground">Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal capitalize text-foreground"><option value="all">All statuses</option>{['open', 'accepted', 'rejected'].map((status) => <option key={status} value={status}>{status === 'accepted' ? 'Confirmed' : status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select></label>
        <label className="text-xs font-medium text-muted-foreground">Date from<input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <label className="text-xs font-medium text-muted-foreground">Date to<input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <label className="text-xs font-medium text-muted-foreground">Total from (£)<input type="number" min="0" value={priceMin} onChange={(event) => { setPriceMin(event.target.value); setPage(1) }} placeholder="0.00" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <label className="text-xs font-medium text-muted-foreground">Total to (£)<input type="number" min="0" value={priceMax} onChange={(event) => { setPriceMax(event.target.value); setPage(1) }} placeholder="Any" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <div className="flex items-end"><button type="button" onClick={resetFilters} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-accent"><RotateCcw className="h-4 w-4" />Reset filters</button></div>
      </div>
    </div>
    <div className="section-card overflow-hidden">
      {isLoading ? <div className="p-10 text-center text-muted-foreground">Loading quotations...</div>
        : isError ? <div className="p-10 text-center text-red-500">Could not load quotations. Check API access and permissions.</div>
          : visibleQuotes.length === 0 ? <div className="p-12 text-center"><FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">No quotations found</p><p className="mt-1 text-sm text-muted-foreground/60">Create a quotation to get started.</p></div>
            : <>
              <div className="overflow-x-auto"><table className="data-table min-w-[1020px]"><thead><tr><th>Quotation</th><th>Reference</th><th>Customer</th><th>Date / valid until</th><th>Status</th><th>VAT</th><th className="text-right">Total</th><th>Actions</th></tr></thead><tbody>
                {paginatedQuotes.rows.map((quote: any) => {
                  const generatingPdf = generatingPdfIds.has(String(quote.id))
                  return <tr key={quote.id}>
                    <td className="font-mono text-sm font-semibold">{quote.quotationNumber}</td>
                    <td className="font-mono text-sm">{formatReferenceNumber(quote.referenceNumber)}</td>
                    <td>{formatCustomerName(quote.customer?.companyName || [quote.customer?.firstName, quote.customer?.lastName].filter(Boolean).join(' ') || '—')}</td>
                    <td className="whitespace-nowrap"><span className="block">{formatDate(quote.quotationDate)}</span><span className="mt-0.5 block text-xs text-muted-foreground">Valid until {quote.validUntilDate ? formatDate(quote.validUntilDate) : '—'}</span></td>
                    <td>{['accepted', 'rejected', 'expired', 'converted_to_job'].includes(quote.status) ? <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold shadow-sm ${quotationStatusStyle(quote.status)}`}>{quotationStatusLabel(quote.status)}</span> : <select aria-label={`Change status for ${quote.quotationNumber}`} value={quote.status} disabled={changeQuotationStatus.isPending} onChange={(event) => { if (event.target.value === 'accepted') { setConfirmError(''); void queryClient.invalidateQueries({ queryKey: ['quotation-invoice-stock-check', quote.id] }); setConfirmingQuote(quote); setReceivedPayment(''); setInitialPaymentMethod('bank_transfer'); setInitialPaymentReceipt(null); setInvoiceDueDate(addDaysToDate(minimumInvoiceDueDate(quote), 30)) } else changeQuotationStatus.mutate({ quote, status: event.target.value }) }} className={`min-h-9 max-w-40 rounded-full border px-3 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60 ${quotationStatusStyle(quote.status)}`}>{quote.status === 'draft' ? <><option value="draft">Draft</option><option value="open">Open</option></> : <><option value={quote.status}>{quotationStatusLabel(quote.status)}</option><option value="accepted">Confirmed · create invoice</option><option value="rejected">Rejected</option></>}</select>}</td>
                    <td>{quote.applyVat === true ? 'Yes' : quote.applyVat === false ? 'No' : Number(quote.vatAmount ?? 0) > 0 ? 'Yes' : 'No'}</td>
                    <td className="text-right font-semibold tabular-nums">{formatCurrency(Number(quote.grandTotal ?? 0))}</td>
                    <td><div className="flex items-center">
                      <button type="button" onClick={() => setViewingQuoteId(String(quote.id))} title="View quotation" aria-label={`View ${quote.quotationNumber}`} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><Eye className="h-4 w-4" /></button>
                      <button type="button" disabled={generatingPdf} onClick={() => void startPdfDownload(String(quote.id), quote.quotationNumber)} title={generatingPdf ? 'Generating quotation PDF' : 'Download client quotation PDF'} aria-label={`${generatingPdf ? 'Generating' : 'Download'} PDF for ${quote.quotationNumber}`} className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:cursor-wait">{generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button>
                      {quote.status === 'draft' && <><button type="button" onClick={() => navigate(`/quotations/new?edit=${encodeURIComponent(quote.id)}`)} title="Edit quotation" aria-label={`Edit ${quote.quotationNumber}`} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button><button type="button" disabled={deleteQuotation.isPending} onClick={() => { if (window.confirm(`Delete draft quotation ${quote.quotationNumber}?`)) deleteQuotation.mutate(quote) }} title="Delete draft quotation" aria-label={`Delete ${quote.quotationNumber}`} className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></>}
                    </div></td>
                  </tr>
                })}
              </tbody></table></div>
              <Pagination page={paginatedQuotes.page} pageSize={pageSize} total={visibleQuotes.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
            </>}
    </div>
    {viewingQuoteId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingQuoteId(null) }}><section role="dialog" aria-modal="true" aria-labelledby="quotation-preview-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-card shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Quotation preview</p><h2 id="quotation-preview-title" className="text-lg font-semibold">{quotationPreview?.quotationNumber || 'Quotation preview'}</h2></div><button type="button" onClick={() => setViewingQuoteId(null)} aria-label="Close quotation preview" className="rounded-lg p-2 hover:bg-accent"><X className="h-5 w-5" /></button></div>{quotationPreviewQuery.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading quotation preview…</p> : quotationPreviewQuery.isError || !quotationPreview ? <p role="alert" className="p-8 text-center text-sm text-red-600">Could not load this quotation preview.</p> : <div className="space-y-5 p-5"><div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prepared for</p><p className="mt-1 font-semibold">{formatCustomerName(quotationPreview.customer?.companyName || [quotationPreview.customer?.firstName, quotationPreview.customer?.lastName].filter(Boolean).join(' ') || 'Customer')}</p>{quotationPreview.customer?.email && <p className="text-sm text-muted-foreground">{quotationPreview.customer.email}</p>}{(quotationPreview.customer?.phone || quotationPreview.customer?.mobile) && <p className="text-sm text-muted-foreground">{quotationPreview.customer.phone || quotationPreview.customer.mobile}</p>}<p className="mt-1 break-words text-sm text-muted-foreground">{getCustomerAddress(quotationPreview.customer) || 'No address provided'}</p></div><div className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dates & status</p><p className="mt-1 text-sm">Reference: {formatReferenceNumber(quotationPreview.referenceNumber)}</p><p className="text-sm">Date: {formatDate(quotationPreview.quotationDate)}</p><p className="text-sm">Valid until: {quotationPreview.validUntilDate ? formatDate(quotationPreview.validUntilDate) : '—'}</p><p className="mt-2"><span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-semibold shadow-sm ${quotationStatusStyle(quotationPreview.status)}`}>{quotationStatusLabel(quotationPreview.status)}</span></p></div></div><div className="overflow-hidden rounded-xl border"><div className="grid grid-cols-[minmax(0,1fr)_55px_100px_110px] gap-2 bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground sm:px-4"><span>Item</span><span className="text-right">Qty</span><span className="text-right">Unit price</span><span className="text-right">Total</span></div>{(quotationPreview.lines || []).map((line: any) => <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_55px_100px_110px] gap-2 border-t px-3 py-3 text-sm sm:px-4"><div className="min-w-0"><p className="truncate font-medium">{line.productName}</p><p className="text-xs text-muted-foreground">{line.modelNumber || line.productSku || '—'}</p></div><span className="text-right tabular-nums">{Number(line.quantity).toLocaleString()}</span><span className="text-right tabular-nums">{formatCurrency(Number(line.unitPrice || 0))}</span><span className="text-right font-medium tabular-nums">{formatCurrency(Number(line.lineTotal || 0))}</span></div>)}{previewAdditionalCharges.length > 0 && <><div className="border-t bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-4">Additional charges</div>{previewAdditionalCharges.map((charge: any) => <div key={charge.id} className="grid grid-cols-[minmax(0,1fr)_110px] gap-2 border-t px-3 py-3 text-sm sm:px-4"><span className="font-medium">{charge.description}</span><span className="text-right font-medium tabular-nums">{formatCurrency(Number(charge.lineTotal || 0))}</span></div>)}</>}</div><div className="ml-auto w-full max-w-sm space-y-2 rounded-xl bg-slate-950 p-4 text-sm text-white"><div className="flex justify-between"><span>Products</span><span>{formatCurrency(Number(quotationPreview.subtotalProducts || 0))}</span></div>{Number(quotationPreview.subtotalLabour || 0) + Number(quotationPreview.subtotalAdditional || 0) > 0 && <div className="flex justify-between"><span>Additional charges</span><span>{formatCurrency(Number(quotationPreview.subtotalLabour || 0) + Number(quotationPreview.subtotalAdditional || 0))}</span></div>}<div className="flex justify-between border-t border-white/20 pt-2"><span>Subtotal{Number(quotationPreview.vatAmount || 0) > 0 ? ' (ex VAT)' : ''}</span><span>{formatCurrency(Number(quotationPreview.taxableAmount || 0) + Number(quotationPreview.discountAmount || 0))}</span></div>{Number(quotationPreview.vatAmount || 0) > 0 && <><div className="space-y-1 border-t border-white/20 pt-2"><p className="font-medium">VAT breakdown</p>{savedVatBreakdown.map(([rate, amount]) => <div key={rate} className="flex justify-between text-xs"><span>VAT at {rate}%</span><span>{formatCurrency(amount)}</span></div>)}</div><div className="flex justify-between"><span>Total VAT</span><span>{formatCurrency(Number(quotationPreview.vatAmount))}</span></div></>}<div className="flex justify-between border-t border-white/20 pt-2 font-semibold"><span>Total</span><span>{formatCurrency(Number(quotationPreview.grandTotal || 0))}</span></div></div>{quotationPreview.notes && <div className="mt-4 rounded-xl border p-4 text-sm"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note</p><p className="whitespace-pre-line">{quotationPreview.notes}</p></div>}</div>}</section></div>}
    {confirmingQuote && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !confirmQuotation.isPending) setConfirmingQuote(null) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="confirm-quotation-title" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <header className="flex items-center justify-between border-b bg-gradient-to-r from-orange-50 to-white px-4 py-3 dark:from-orange-950/20 dark:to-card sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Confirm quotation</p><h2 id="confirm-quotation-title" className="truncate text-lg font-semibold">Create invoice <span className="text-muted-foreground">· {confirmingQuote.quotationNumber}</span></h2></div>
            </div>
            <button type="button" onClick={() => setConfirmingQuote(null)} disabled={confirmQuotation.isPending} aria-label="Close confirmation" className="ml-3 rounded-lg p-2 text-muted-foreground hover:bg-black/5 disabled:opacity-50"><X className="h-5 w-5" /></button>
          </header>
          <div className="space-y-3 overflow-y-auto p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_0.9fr]">
              <label className="block rounded-xl border bg-background p-3"><span className="form-label">Invoice due date *</span><input required type="date" min={invoiceDueDateMinimum} value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-muted/20 px-3 py-2 text-sm" /><span className="mt-1.5 block text-[11px] leading-snug text-muted-foreground">Due date must be today or later, and on or after the quotation date.</span></label>
              <div className="flex flex-col justify-center rounded-xl bg-slate-950 p-3 text-white"><span className="text-[11px] font-medium uppercase tracking-wide text-slate-300">Invoice total</span><strong className="mt-0.5 text-xl tabular-nums">{formatCurrency(invoiceTotalForConfirmation)}</strong><span className="mt-0.5 text-[11px] text-slate-400">From quotation {confirmingQuote.quotationNumber}</span></div>
            </div>

            <section className={"rounded-xl border p-3 " + (invoiceStockQuery.isError || invoiceStockCheck?.canProceed === false ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20' : 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/10')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3"><span className="rounded-lg bg-background p-2 text-primary"><Package className="h-5 w-5" /></span><div><h3 className="font-semibold">Stock availability</h3><p className="mt-0.5 text-xs text-muted-foreground">Invoice quantities will be deducted from {invoiceStockCheck?.location || 'the default stock location'}.</p></div></div>
                {!invoiceStockQuery.isFetching && !invoiceStockQuery.isError && invoiceStockCheck && <span className={"inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " + (invoiceStockCheck.canProceed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
                  {invoiceStockCheck.canProceed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}{invoiceStockCheck.canProceed ? 'Stock available' : 'Insufficient stock'}
                </span>}
              </div>
              {invoiceStockQuery.isFetching ? <p className="mt-4 rounded-lg bg-background/80 px-3 py-3 text-sm text-muted-foreground">Checking the latest stock availability…</p>
                : invoiceStockQuery.isError || !invoiceStockCheck ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-white px-3 py-3 text-sm text-red-700">Could not check stock. Refresh the stock data before creating this invoice.</p>
                  : <>
                    <p className={"mt-2 text-xs " + (invoiceStockCheck.canProceed ? 'text-muted-foreground' : 'font-medium text-red-700 dark:text-red-300')}>{invoiceStockCheck.canProceed ? 'All requested quantities are available.' : 'Receive the missing quantities before creating this invoice.'}</p>
                    <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                      {invoiceStockCheck.items.map((item: any) => <div key={item.productId} className={`rounded-xl border bg-background p-2.5 ${item.shortage > 0 ? 'border-red-200' : 'border-black/5'}`}>
                        <div className="mb-2 flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong>{item.sku && <span className="mt-0.5 block text-[11px] text-muted-foreground">Code: {item.sku}</span>}</div>{item.shortage > 0 && <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700">Short by {Number(item.shortage).toLocaleString()}</span>}</div>
                        {item.stockable ? <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-900/60"><span className="block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Requested qty</span><strong className="mt-0.5 block text-sm tabular-nums">{Number(item.quantity).toLocaleString()}</strong></div><div className={`rounded-lg px-2 py-1.5 ${item.shortage > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-sky-50 dark:bg-sky-950/20'}`}><span className="block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Available</span><strong className={`mt-0.5 block text-sm tabular-nums ${item.shortage > 0 ? 'text-red-700' : 'text-sky-800 dark:text-sky-300'}`}>{Number(item.available).toLocaleString()}</strong></div><div className={`rounded-lg px-2 py-1.5 ${item.shortage > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-emerald-50 dark:bg-emerald-950/20'}`}><span className="block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">After invoice</span><strong className={`mt-0.5 block text-sm tabular-nums ${item.shortage > 0 ? 'text-red-700' : 'text-emerald-800 dark:text-emerald-300'}`}>{item.shortage > 0 ? '—' : Number(item.availableAfter).toLocaleString()}</strong></div></div> : <span className="text-xs text-muted-foreground">Stock not tracked</span>}
                      </div>)}
                    </div>
                    {invoiceStockCheck.items.length === 0 && <p className="mt-3 rounded-lg bg-background px-3 py-3 text-sm text-muted-foreground">No stock-tracked product lines in this quotation.</p>}
                  </>}
            </section>

            {confirmError && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Invoice could not be created</p><p className="mt-1 leading-relaxed">{confirmError}</p></div></div>}

            <section className="rounded-xl border p-3">
              <div className="mb-2"><h3 className="text-sm font-semibold">Record initial payment</h3><p className="mt-0.5 text-[11px] text-muted-foreground">Enter an amount if the customer has already paid.</p></div>
              <label className="block text-sm font-medium">Payment received<input type="text" inputMode="decimal" maxLength={14} value={receivedPayment} onChange={(event) => { let raw = event.target.value.replace(/[^\d.]/g, ''); if ((raw.match(/\./g) || []).length > 1 || (raw.includes('.') && raw.split('.')[1].length > 2)) return; if (raw.startsWith('.')) raw = '0' + raw; else raw = raw.replace(/^0+(?=\d)/, ''); const amount = Number(raw); if (raw && Number.isFinite(amount) && amount > invoiceTotalForConfirmation) return; setReceivedPayment(raw) }} placeholder="0.00" aria-describedby="payment-due payment-limit" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm tabular-nums" /></label>
              {receivedPaymentValue > 0 && <div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="block text-xs font-medium text-muted-foreground">Payment method<select value={initialPaymentMethod} onChange={(event) => setInitialPaymentMethod(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground">{[['bank_transfer', 'Bank transfer'], ['cash', 'Cash'], ['card', 'Card'], ['cheque', 'Cheque'], ['other', 'Other']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-xs font-medium text-muted-foreground">Attach receipt (optional)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setInitialPaymentReceipt(event.target.files?.[0] || null)} className="mt-1 block min-h-10 w-full rounded-lg border bg-background px-2 py-1.5 text-xs font-normal text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"/><span className="mt-0.5 block text-[10px]">PDF, JPG, PNG, or WebP · up to 10 MB</span></label></div>}
              <div id="payment-due" className={`mt-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${Math.max(0, invoiceTotalForConfirmation - (Number.isFinite(receivedPaymentValue) ? receivedPaymentValue : 0)) === 0 ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card' : 'border-orange-200 bg-gradient-to-r from-orange-50 to-white dark:from-orange-950/25 dark:to-card'}`}><div className="flex items-center gap-2.5"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${Math.max(0, invoiceTotalForConfirmation - (Number.isFinite(receivedPaymentValue) ? receivedPaymentValue : 0)) === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{Math.max(0, invoiceTotalForConfirmation - (Number.isFinite(receivedPaymentValue) ? receivedPaymentValue : 0)) === 0 ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}</span><div><span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due after payment</span><span className="block text-[10px] text-muted-foreground">{Math.max(0, invoiceTotalForConfirmation - (Number.isFinite(receivedPaymentValue) ? receivedPaymentValue : 0)) === 0 ? 'Invoice will be fully paid' : 'Remaining invoice balance'}</span></div></div><strong className={`text-lg tabular-nums ${Math.max(0, invoiceTotalForConfirmation - (Number.isFinite(receivedPaymentValue) ? receivedPaymentValue : 0)) === 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-orange-800 dark:text-orange-300'}`}>{formatCurrency(Math.max(0, invoiceTotalForConfirmation - (Number.isFinite(receivedPaymentValue) ? receivedPaymentValue : 0)))}</strong></div>
              {!validReceivedPayment && <p id="payment-limit" role="alert" className="mt-2 text-xs text-red-600">Payment cannot exceed the invoice total of {formatCurrency(invoiceTotalForConfirmation)}.</p>}
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Payment determines whether the invoice is unpaid, partially paid, or fully paid.</p>
            </section>
          </div>
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/10 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <button type="button" onClick={() => setConfirmingQuote(null)} disabled={confirmQuotation.isPending} className="min-h-11 rounded-lg border bg-background px-5 text-sm font-medium hover:bg-accent">Cancel</button>
            <button type="button" disabled={confirmQuotation.isPending || !invoiceDueDateIsValid || !validReceivedPayment || invoiceStockQuery.isFetching || invoiceStockQuery.isError || !invoiceStockCheck} onClick={() => { setConfirmError(''); confirmQuotation.mutate() }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{(confirmQuotation.isPending || invoiceStockQuery.isFetching) && <Loader2 className="h-4 w-4 animate-spin" />}{invoiceStockQuery.isFetching ? 'Checking stock…' : confirmQuotation.isPending ? 'Creating invoice…' : 'Confirm & create invoice'}</button>
          </footer>
        </section>
      </div>
    )}
  </div>
}

type QuoteLine = { productId: string; quantity: string; unitPrice: string }
type AdditionalCharge = { description: string; price: string; vatRate: number }

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysToDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(year, month - 1, day)
  result.setDate(result.getDate() + days)
  return formatLocalDate(result)
}

function minimumInvoiceDueDate(quotation: any) {
  const today = formatLocalDate(new Date())
  const quotationDate = String(quotation?.quotationDate || '').slice(0, 10)
  return quotationDate > today ? quotationDate : today
}

function getCustomerAddress(customer: any) {
  if (!customer) return ''
  const billingParts = [customer.billingAddressLine1, customer.billingAddressLine2, customer.billingCity, customer.billingPostcode].filter(Boolean)
  if (billingParts.length) return [...billingParts, customer.billingCountry].filter(Boolean).join(', ')
  const address = customer.addresses?.find((item: any) => item.isPrimary) || customer.addresses?.[0]
  return address ? [address.addressLine1, address.addressLine2, address.city, address.county, address.postcode, address.country].filter(Boolean).join(', ') : ''
}

function getQuotationVatBreakdown(quotation: any) {
  const breakdown = new Map<number, number>()
  for (const line of quotation?.lines || []) {
    const rate = Number(line.vatRate || 0)
    const amount = Number(line.vatAmount ?? (Number(line.lineTotal || 0) * rate / 100))
    if (amount > 0) breakdown.set(rate, (breakdown.get(rate) || 0) + amount)
  }
  for (const charge of [...(quotation?.labourCharges || []), ...(quotation?.additionalCharges || [])]) {
    const rate = Number(charge.vatRate || 0)
    const amount = Number(charge.vatAmount ?? (Number(charge.lineTotal || 0) * rate / 100))
    if (amount > 0) breakdown.set(rate, (breakdown.get(rate) || 0) + amount)
  }
  return [...breakdown.entries()].sort(([left], [right]) => left - right)
}

export function NewQuotationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [step, setStep] = useState<1 | 2>(1)
  const [customerId, setCustomerId] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [quotationDate, setQuotationDate] = useState(() => formatLocalDate(new Date()))
  const [validUntilDate, setValidUntilDate] = useState(() => addDaysToDate(formatLocalDate(new Date()), 15))
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '', billingAddressLine1: '', billingAddressLine2: '', billingCity: '', billingPostcode: '', billingCountry: 'United Kingdom' })
  const [createdCustomer, setCreatedCustomer] = useState<any | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [lines, setLines] = useState<QuoteLine[]>([{ productId: '', quantity: '1', unitPrice: '' }])
  const [productPickerOpen, setProductPickerOpen] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([])
  const [notes, setNotes] = useState('')
  const [applyVat, setApplyVat] = useState(true)
  const [validationError, setValidationError] = useState('')
  const [checkingBeforeContinue, setCheckingBeforeContinue] = useState(false)
  const editQuery = useQuery({ queryKey: ['quotation', editId], queryFn: () => api.get(`/quotations/${editId}`) as any, enabled: !!editId })
  const customersQuery = useQuery({ queryKey: ['quote-customers'], queryFn: () => api.get('/customers?limit=200') as any })
  const productsQuery = useQuery({ queryKey: ['quote-products'], queryFn: () => api.get('/products?limit=200&isActive=true') as any })
  const customerResponse = customersQuery.data as any
  const customerList = customerResponse?.data?.data ?? customerResponse?.data ?? customerResponse
  const customers = Array.isArray(customerList) ? customerList : []
  const quotation = (editQuery.data as any)?.data
  const products = useMemo(() => ((productsQuery.data as any)?.data?.data ?? []).filter((product: any) => product.isActive === true || product.isActive === 'true' || quotation?.lines?.some((line: any) => line.productId === product.id)), [productsQuery.data, quotation?.lines])
  const activeProducts = products.filter((product: any) => product.isActive === true || product.isActive === 'true')
  const filteredProducts = activeProducts.filter((product: any) => [product.name, product.sku, product.modelNumber, product.manufacturer, product.brand?.name, product.category?.name].filter(Boolean).join(' ').toLowerCase().includes(productSearch.trim().toLowerCase()))
  const customerOptions = [...customers]
  for (const fallbackCustomer of [quotation?.customer, createdCustomer]) {
    if (fallbackCustomer?.id && !customerOptions.some((customer: any) => String(customer.id) === String(fallbackCustomer.id))) customerOptions.unshift(fallbackCustomer)
  }
  const selectedCustomer = customerOptions.find((customer: any) => String(customer.id) === String(customerId))
  const selectedCustomerAddress = getCustomerAddress(selectedCustomer)
  const customerCode = (customer: any) => customer?.customerCode ?? customer?.customer_code ?? ''
  const customerDisplayId = (customer: any) => customerCode(customer) || customer?.id || ''
  const customerName = (customer: any) => formatCustomerName(customer?.companyName?.trim()
    || [customer?.firstName ?? customer?.first_name, customer?.lastName ?? customer?.last_name].filter(Boolean).join(' ').trim()
    || customer?.name?.trim()
    || customer?.customerName?.trim()
    || customer?.customer_name?.trim()
    || customer?.fullName?.trim()
    || customer?.contactName?.trim()
    || customer?.displayName?.trim()
    || (customerCode(customer) ? `Customer ${customerCode(customer)}` : 'Unnamed customer'))
  const filteredCustomers = customerOptions.filter((customer: any) => `${customerName(customer)} ${customerDisplayId(customer)}`.toLowerCase().includes(customerSearch.trim().toLowerCase()))
  useEffect(() => {
    if (!quotation) return
    setCustomerId(String(quotation.customerId || quotation.customer?.id || ''))
    setReferenceNumber(String(quotation.referenceNumber || ''))
    setQuotationDate(String(quotation.quotationDate).slice(0, 10))
    setValidUntilDate(quotation.validUntilDate ? String(quotation.validUntilDate).slice(0, 10) : '')
    const savedRates = (quotation.lines || []).map((line: any) => Number(line.vatRate ?? 0))
    setApplyVat(savedRates.length ? savedRates.some((rate: number) => rate > 0) : Number(quotation.vatAmount ?? 0) > 0)
    const quoteLines = (quotation.lines || []).map((line: any) => ({ productId: line.productId || '', quantity: String(line.quantity ?? 1), unitPrice: String(line.unitPrice ?? '') }))
    setLines(quoteLines.length ? quoteLines : [{ productId: '', quantity: '1', unitPrice: '' }])
    const legacyCharges = (quotation.labourCharges || []).map((charge: any) => ({ description: charge.description || '', price: String(charge.lineTotal ?? Number(charge.quantity ?? 1) * Number(charge.unitRate ?? 0)), vatRate: Number(charge.vatRate ?? 20) }))
    const savedAdditionalCharges = (quotation.additionalCharges || []).map((charge: any) => ({ description: charge.description || '', price: String(charge.lineTotal ?? Number(charge.quantity ?? 1) * Number(charge.unitPrice ?? 0)), vatRate: Number(charge.vatRate ?? 20) }))
    setAdditionalCharges([...legacyCharges, ...savedAdditionalCharges])
    setNotes(String(quotation.notes || ''))
  }, [quotation])
  const selectedLines = lines.map((line) => ({ line, product: products.find((product: any) => product.id === line.productId) })).filter(({ product }) => product)
  const renderChargeSection = (title: string, charges: AdditionalCharge[], update: (fn: (current: AdditionalCharge[]) => AdditionalCharge[]) => void) => <section className="section-card overflow-hidden">
    <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{title} <span className="font-normal text-muted-foreground">(optional)</span></h2><p className="text-sm text-muted-foreground">Add any {title.toLowerCase()} to this quotation.</p></div><button type="button" onClick={() => update((current) => [...current, { description: '', price: '', vatRate: 20 }])} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"><Plus className="mr-1 h-4 w-4" />Add {title.toLowerCase().replace(/s$/, '')}</button></div>
    {charges.length > 0 ? <div className="space-y-3 p-5">{charges.map((charge, index) => <div key={index} className="grid min-w-0 grid-cols-1 items-start gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_200px_40px]"><label className="min-w-0"><span className="form-label">Description *</span><textarea required rows={1} value={charge.description} onChange={(event) => update((current) => current.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} placeholder="Describe this additional charge" className="min-h-11 w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm" /></label><label><span className="form-label">Price{applyVat ? ' (£ ex VAT)' : ''} *</span><input required min="0" step="0.01" type="number" value={charge.price} onChange={(event) => update((current) => current.map((item, i) => i === index ? { ...item, price: event.target.value } : item))} placeholder="0.00" className="min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label><button type="button" onClick={() => update((current) => current.filter((_, i) => i !== index))} aria-label="Remove additional charge" title="Remove additional charge" className="inline-flex h-11 w-10 items-center justify-center self-end rounded-lg text-red-600 hover:bg-red-100"><X className="h-5 w-5" /></button></div>)}<div className="flex justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">{title} subtotal{applyVat ? ' (ex VAT)' : ''}</span><span className="font-semibold">{formatCurrency(charges.reduce((sum, charge) => sum + roundMoney(Number(charge.price || 0)), 0))}</span></div></div> : <p className="p-5 text-sm text-muted-foreground">No {title.toLowerCase()}. Add any optional items here.</p>}
  </section>
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  const productSubtotal = roundMoney(selectedLines.reduce((sum, { line }) => sum + roundMoney(Number(line.quantity || 0) * Number(line.unitPrice || 0)), 0))
  const additionalChargesSubtotal = additionalCharges.reduce((sum, charge) => sum + roundMoney(Number(charge.price || 0)), 0)
  const total = roundMoney(productSubtotal + additionalChargesSubtotal)
  const vatBuckets = new Map<number, { taxable: number; vat: number }>()
  const recordVat = (taxableAmount: number, rate: number) => {
    const taxable = roundMoney(taxableAmount)
    const existing = vatBuckets.get(rate) || { taxable: 0, vat: 0 }
    vatBuckets.set(rate, { taxable: existing.taxable + taxable, vat: existing.vat + roundMoney(taxable * rate / 100) })
  }
  selectedLines.forEach(({ line, product }) => recordVat(Number(line.quantity || 0) * Number(line.unitPrice || 0), applyVat ? Number(product.vatRate?.rate ?? 20) : 0))
  additionalCharges.forEach((charge) => recordVat(Number(charge.price || 0), applyVat ? Number(charge.vatRate ?? 20) : 0))
  const vatBreakdown = [...vatBuckets.entries()].sort(([a], [b]) => a - b)
  const estimatedVat = roundMoney(vatBreakdown.reduce((sum, [, amounts]) => sum + amounts.vat, 0))
  const createCustomer = useMutation({
    mutationFn: async () => {
      const response: any = await api.post('/customers', { type: 'individual', ...newCustomer })
      const record = response?.data?.data ?? response?.data ?? response
      const customer = record?.id ? {
        ...record,
        firstName: record.firstName ?? record.first_name ?? newCustomer.firstName,
        lastName: record.lastName ?? record.last_name ?? newCustomer.lastName,
        email: record.email ?? newCustomer.email,
        phone: record.phone ?? newCustomer.phone,
        billingAddressLine1: record.billingAddressLine1 ?? newCustomer.billingAddressLine1,
        billingAddressLine2: record.billingAddressLine2 ?? newCustomer.billingAddressLine2,
        billingCity: record.billingCity ?? newCustomer.billingCity,
        billingPostcode: record.billingPostcode ?? newCustomer.billingPostcode,
        billingCountry: record.billingCountry ?? newCustomer.billingCountry,
      } : record
      if (!customer?.id) throw new Error('The customer was saved, but the server did not return the customer record.')
      return customer
    },
    onSuccess: (customer: any) => {
      setCreatedCustomer(customer)
      queryClient.setQueryData(['quote-customers'], (current: any) => {
        const list = current?.data?.data ?? current?.data ?? current
        if (!Array.isArray(list)) return current
        const next = [customer, ...list.filter((item: any) => String(item.id) !== String(customer.id))]
        if (Array.isArray(current)) return next
        if (Array.isArray(current?.data?.data)) return { ...current, data: { ...current.data, data: next } }
        if (Array.isArray(current?.data)) return { ...current, data: next }
        return next
      })
      setCustomerId(String(customer.id))
      setCustomerSearch('')
      setCustomerPickerOpen(false)
      setShowCustomerForm(false)
      setNewCustomer({ firstName: '', lastName: '', email: '', phone: '', billingAddressLine1: '', billingAddressLine2: '', billingCity: '', billingPostcode: '', billingCountry: 'United Kingdom' })
      void queryClient.invalidateQueries({ queryKey: ['quote-customers'] })
    },
  })

  const createQuote = useMutation({
    mutationFn: () => {
      const payload = {
        customerId,
        referenceNumber: referenceNumber.trim(),
        submit: true,
        applyVat,
        quotationDate,
        validUntilDate: validUntilDate || undefined,
        notes: notes.trim() || undefined,
        lines: selectedLines.map(({ line, product }) => ({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        modelNumber: product.modelNumber,
        description: product.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        vatRate: applyVat ? Number(product.vatRate?.rate ?? 20) : 0,
        })),
        additionalCharges: additionalCharges.filter((charge) => charge.description.trim()).map((charge) => ({
          description: charge.description.trim(),
          quantity: 1,
          unitPrice: Number(charge.price || 0),
          vatRate: applyVat ? charge.vatRate : 0,
        })),
      }
      return editId ? api.patch(`/quotations/${editId}`, payload) : api.post('/quotations', payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quotations'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      navigate('/quotations')
    },
  })

  const updateLine = (index: number, patch: Partial<QuoteLine>) => {
    setValidationError('')
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line))
  }
  const validateQuote = () => {
    if (!customerId) return 'Choose a customer before continuing.'
    if (!referenceNumber.trim()) return 'Enter a reference number for this quotation.'
    if (!quotationDate || Number.isNaN(Date.parse(quotationDate))) return 'Enter a valid quotation date.'
    if (validUntilDate && (Number.isNaN(Date.parse(validUntilDate)) || validUntilDate < quotationDate)) return 'The valid-until date must be on or after the quotation date.'
    if (!lines.length || lines.some((line) => !line.productId)) return 'Choose a catalogue product for every product row.'

    for (const line of lines) {
      const quantity = Number(line.quantity)
      const unitPrice = Number(line.unitPrice)
      if (!line.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-7) {
        return 'Each quantity must be greater than zero and use no more than three decimal places.'
      }
      if (!line.unitPrice.trim() || !Number.isFinite(unitPrice) || unitPrice < 0 || Math.abs(unitPrice * 100 - Math.round(unitPrice * 100)) > 1e-7) {
        return 'Each unit price must be zero or more and use no more than two decimal places.'
      }
      const product = products.find((item: any) => String(item.id) === line.productId)
      if (!product || !(product.isActive === true || product.isActive === 'true')) return 'A selected product is no longer active. Choose an active catalogue product.'
    }
    if (additionalCharges.some((charge) => !charge.description.trim() || !charge.price.trim() || !Number.isFinite(Number(charge.price)) || Number(charge.price) < 0 || Math.abs(Number(charge.price) * 100 - Math.round(Number(charge.price) * 100)) > 1e-7)) {
      return 'Each additional charge needs a description and a valid non-negative price with no more than two decimal places.'
    }
    return ''
  }
  const handleQuoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError('')
    setCheckingBeforeContinue(true)
    try {
      const error = validateQuote()
      if (error) {
        setValidationError(error)
        return
      }
      if (step === 1) setStep(2)
      else createQuote.mutate()
    } finally {
      setCheckingBeforeContinue(false)
    }
  }

  if (editId && editQuery.isLoading) return <div className="p-10 text-center text-muted-foreground">Loading quotation…</div>
  if (editId && (editQuery.isError || !quotation)) return <div role="alert" className="p-10 text-center text-red-600">Could not load this quotation for editing.</div>

  return <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
    <div className="page-header mb-0"><h1 className="page-title">{editId ? `Edit quotation ${quotation.quotationNumber}` : 'New quotation'}</h1><p className="page-description">Add the customer and materials, then review the client copy before saving.</p></div>
    <div className="grid grid-cols-2 gap-3" aria-label="Quotation steps">
      <div aria-current={step === 1 ? 'step' : undefined} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors sm:p-4 ${step === 1 ? 'border-primary bg-primary/5' : 'bg-card'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${step === 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>1</span><span><strong className="block text-sm">Details & materials</strong><span className="hidden text-xs text-muted-foreground sm:block">Choose the customer and items</span></span></div>
      <div aria-current={step === 2 ? 'step' : undefined} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors sm:p-4 ${step === 2 ? 'border-primary bg-primary/5' : 'bg-card'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${step === 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>2</span><span><strong className="block text-sm">Preview & submit</strong><span className="hidden text-xs text-muted-foreground sm:block">Check the customer copy and totals</span></span></div>
    </div>
    <form className="space-y-6" onSubmit={handleQuoteSubmit}>
      {step === 1 && <>
      <section className="section-card grid items-start gap-4 p-6 sm:grid-cols-5">
        <div className="min-w-0 sm:col-span-2"><label htmlFor="customer-search" className="form-label">Customer *</label><div className="flex min-w-0 gap-2"><div className="relative min-w-0 flex-1"><input id="customer-search" type="text" role="combobox" aria-autocomplete="list" aria-expanded={customerPickerOpen} aria-controls="customer-options" autoComplete="off" required={!customerId} value={customerPickerOpen ? customerSearch : selectedCustomer ? `${customerName(selectedCustomer)}${customerDisplayId(selectedCustomer) ? ` · ${customerDisplayId(selectedCustomer)}` : ''}` : customerSearch} onFocus={() => { setCustomerPickerOpen(true); setCustomerSearch('') }} onBlur={() => window.setTimeout(() => setCustomerPickerOpen(false), 120)} onKeyDown={(event) => { if (event.key === 'Escape') setCustomerPickerOpen(false); if (event.key === 'ArrowDown') setCustomerPickerOpen(true) }} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerId(''); setCustomerPickerOpen(true) }} placeholder="Search name or customer ID…" className="min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-sm" />{customerPickerOpen && <div id="customer-options" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-lg border bg-popover p-1 shadow-xl">{filteredCustomers.length ? filteredCustomers.map((customer: any) => <button key={customer.id} type="button" role="option" aria-selected={String(customer.id) === String(customerId)} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCustomerId(String(customer.id)); setCustomerSearch(''); setCustomerPickerOpen(false) }} className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent"><span className="w-full truncate font-medium leading-5 text-foreground">{customerName(customer)}</span><span className="text-xs leading-4 text-muted-foreground">ID: {customerDisplayId(customer) || 'Unavailable'}</span></button>) : <p className="px-3 py-2 text-sm text-muted-foreground">No customers match that name or ID.</p>}</div>}</div><button type="button" onClick={() => setShowCustomerForm(true)} title="Add customer" aria-label="Add customer" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border hover:bg-accent"><UserPlus className="h-4 w-4" /></button></div>{selectedCustomer && <div className="mt-2 space-y-0.5 text-xs text-muted-foreground"><p className="truncate font-medium text-foreground">{customerName(selectedCustomer)}{customerCode(selectedCustomer) ? ` · ${customerCode(selectedCustomer)}` : ''}</p>{(selectedCustomer.phone || selectedCustomer.mobile) && <p>Phone: {selectedCustomer.phone || selectedCustomer.mobile}</p>}{selectedCustomer.email && <p className="truncate">Email: {selectedCustomer.email}</p>}<p className="break-words">Address: {selectedCustomerAddress || 'Not provided'}</p><p className="break-all">Customer ID: {customerCode(selectedCustomer) || 'Customer code unavailable — run database migrations'}</p></div>}</div>
        <label className="block"><span className="form-label min-h-[21px]">Quotation date *</span><input required type="date" value={quotationDate} onChange={(event) => { setValidationError(''); setQuotationDate(event.target.value) }} className="min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label className="block"><span className="form-label min-h-[21px]">Valid until *</span><input required type="date" min={quotationDate || undefined} value={validUntilDate} onChange={(event) => { setValidationError(''); setValidUntilDate(event.target.value) }} className="min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label className="block"><span className="form-label min-h-[21px]">Reference number *</span><input required maxLength={100} value={referenceNumber} onChange={(event) => { setValidationError(''); setReferenceNumber(event.target.value) }} placeholder="Enter a unique reference" className="min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /><span className="mt-1 block text-xs text-muted-foreground">Must be unique across quotations.</span></label>
      </section>

      <section className="section-card overflow-hidden">
        <div className="flex items-center gap-3 border-b px-5 py-4"><input id="quotation-apply-vat" type="checkbox" checked={applyVat} onChange={(event) => setApplyVat(event.target.checked)} className="h-4 w-4 accent-primary" /><label htmlFor="quotation-apply-vat" className="text-sm font-medium">Apply VAT to each product and additional charge</label></div>
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Products</h2><p className="text-sm text-muted-foreground">Unit prices are taken from the material catalogue. Quotation quantities are independent of current stock.</p></div><button type="button" onClick={() => setLines((current) => [...current, { productId: '', quantity: '1', unitPrice: '' }])} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"><Plus className="mr-1 h-4 w-4" />Add product</button></div>
        <div className="space-y-3 p-5">{lines.map((line, index) => {
          const product = products.find((item: any) => item.id === line.productId)
          return <div key={index} className="grid min-w-0 grid-cols-1 items-start gap-3 rounded-xl border bg-card p-4 transition-colors lg:grid-cols-[minmax(0,1fr)_150px_180px_40px]">
            <label className="block min-w-0"><span className="form-label min-h-[21px]">Product *</span><div className="relative"><input type="text" role="combobox" aria-autocomplete="list" aria-expanded={productPickerOpen === index} aria-controls={`quote-product-options-${index}`} autoComplete="off" required={!line.productId} value={productPickerOpen === index ? productSearch : product ? `${product.name}${product.sku ? ` · ${product.sku}` : ''}` : ''} onFocus={() => { setProductPickerOpen(index); setProductSearch('') }} onBlur={() => window.setTimeout(() => setProductPickerOpen((current) => current === index ? null : current), 120)} onKeyDown={(event) => { if (event.key === 'Escape') setProductPickerOpen(null); if (event.key === 'ArrowDown') setProductPickerOpen(index); if (event.key === 'Enter' && productPickerOpen === index && filteredProducts[0]) { event.preventDefault(); const item = filteredProducts[0]; updateLine(index, { productId: String(item.id), unitPrice: Number(item.purchasePrice ?? 0).toFixed(2) }); setProductPickerOpen(null); setProductSearch('') } }} onChange={(event) => { setProductSearch(event.target.value); setProductPickerOpen(index); setValidationError('') }} placeholder="Search active products…" className="min-h-11 w-full rounded-lg border bg-background py-2.5 pl-3 pr-9 text-sm" /><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></div>{productPickerOpen === index && <div id={`quote-product-options-${index}`} role="listbox" className="mt-1 max-h-56 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">{productsQuery.isLoading ? <p className="px-3 py-2 text-sm text-muted-foreground">Loading active products…</p> : filteredProducts.length ? filteredProducts.map((item: any) => <button key={item.id} type="button" role="option" aria-selected={String(item.id) === String(line.productId)} onMouseDown={(event) => event.preventDefault()} onClick={() => { updateLine(index, { productId: String(item.id), unitPrice: Number(item.purchasePrice ?? 0).toFixed(2) }); setProductPickerOpen(null); setProductSearch('') }} className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent"><span className="font-medium">{item.name}{item.sku && <span className="ml-2 font-mono text-xs text-muted-foreground">{item.sku}</span>}</span><span className="text-xs text-muted-foreground">{[item.manufacturer || item.brand?.name, item.modelNumber].filter(Boolean).join(' · ') || 'No additional product details'}</span></button>) : <p className="px-3 py-2 text-sm text-muted-foreground">No active products match that search.</p>}</div>}<span className="mt-1 block min-h-4 truncate text-xs text-muted-foreground">{product ? `${product.manufacturer || product.brand?.name || '—'} · ${product.modelNumber || 'No model'}` : 'Choose an active catalogue product'}</span></label>
            <label className="block"><span className="form-label min-h-[21px]">Quantity *</span><input required min="0.001" step="0.001" type="number" inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
            <label className="block"><span className="form-label min-h-[21px]">Unit price (ex VAT)</span><input required readOnly aria-readonly="true" min="0" step="0.01" type="number" value={line.unitPrice} className="min-h-11 w-full cursor-not-allowed rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-foreground tabular-nums" placeholder="From catalogue" /></label>
            {lines.length > 1 && <button type="button" onClick={() => { if (!window.confirm(`Remove ${product?.name || 'this product'} from the quotation?`)) return; setValidationError(''); setLines((current) => current.filter((_, i) => i !== index)) }} className="inline-flex h-11 w-10 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 lg:mt-[27px]" aria-label={`Remove ${product?.name || 'product'} from quotation`} title="Remove product"><X className="h-5 w-5" /></button>}
          </div>
        })}</div>
        <div className="flex justify-between border-t p-5 text-sm"><span className="text-muted-foreground">Products subtotal{applyVat ? ' (ex VAT)' : ''}</span><span className="font-semibold">{formatCurrency(productSubtotal)}</span></div>
      </section>
      {renderChargeSection('Additional charges', additionalCharges, setAdditionalCharges)}
      <section className="section-card space-y-4 p-5">
        <div><h2 className="font-semibold">Quotation note</h2><p className="text-sm text-muted-foreground">This note appears below the quotation details.</p></div>
        <label className="block"><span className="form-label">Note / description</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a note or description for the customer" className="min-h-20 w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
      </section>
      </>}
      {step === 2 && <>
      <section className="overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-white via-orange-50/50 to-slate-50 shadow-sm dark:from-card dark:via-card dark:to-muted/30">
        <div className="flex flex-col gap-1 border-b border-orange-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Client preview</p><h2 className="mt-1 text-lg font-semibold">Quotation summary</h2></div><div className="text-right"><span className="block w-fit rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm dark:bg-background">{editId ? quotation.quotationNumber : 'Quotation number assigned on save'}</span><span className="mt-1 block text-xs text-muted-foreground">Reference: {referenceNumber || 'Not entered'}</span></div></div>
        <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0"><div className="mb-4 grid gap-3 rounded-xl border bg-white/80 p-4 text-sm dark:bg-background sm:grid-cols-2"><div><span className="block text-xs uppercase tracking-wide text-muted-foreground">Prepared for</span><strong className="mt-1 block truncate">{selectedCustomer ? customerName(selectedCustomer) : 'Choose a customer to preview'}</strong>{(selectedCustomer?.phone || selectedCustomer?.mobile) && <span className="block text-xs text-muted-foreground">Phone: {selectedCustomer.phone || selectedCustomer.mobile}</span>}{selectedCustomer?.email && <span className="block truncate text-xs text-muted-foreground">{selectedCustomer.email}</span>}{selectedCustomer && <span className="mt-1 block break-words text-xs text-muted-foreground">Address: {selectedCustomerAddress || 'Not provided'}</span>}<span className="mt-1 block break-all text-[11px] text-muted-foreground">Customer ID: {customerCode(selectedCustomer) || 'Customer code unavailable — run database migrations'}</span></div><div className="sm:text-right"><span className="block text-xs uppercase tracking-wide text-muted-foreground">Dates</span><strong className="mt-1 block">{formatDate(quotationDate)}</strong><span className="text-xs text-muted-foreground">Valid until {validUntilDate ? formatDate(validUntilDate) : '—'}</span></div></div>
            {selectedLines.length ? <div className="space-y-2">{selectedLines.map(({ line, product }, index) => <div key={`${product.id}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm dark:bg-background"><div className="min-w-0"><p className="truncate font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.modelNumber || product.sku || 'No model/code'} · Qty {Number(line.quantity || 0).toLocaleString()}</p></div><div className="shrink-0 text-right"><p className="font-semibold tabular-nums">{formatCurrency(Number(line.quantity || 0) * Number(line.unitPrice || 0))}</p></div></div>)}</div> : <div className="rounded-xl border border-dashed bg-white/60 p-6 text-center text-sm text-muted-foreground dark:bg-background">Add a material to see it in the client preview.</div>}
            {additionalCharges.length > 0 && <div className="mt-3 space-y-2"><p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional charges</p>{additionalCharges.map((charge, index) => <div key={index} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm dark:bg-background"><p className="min-w-0 truncate font-medium">{charge.description || 'Additional charge'}</p><strong className="shrink-0 tabular-nums">{formatCurrency(Number(charge.price || 0))}</strong></div>)}</div>}{notes.trim() && <div className="mt-4 rounded-lg border bg-white/70 p-3 text-sm dark:bg-background"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note</p><p className="whitespace-pre-line">{notes}</p></div>}
          </div>
          <div className="flex flex-col justify-center rounded-xl bg-slate-950 p-4 text-white shadow-inner"><p className="text-xs font-medium uppercase tracking-wide text-white/55">Estimated totals</p><div className="mt-4 flex justify-between gap-2 text-sm text-white/75"><span>Products</span><span className="tabular-nums">{formatCurrency(productSubtotal)}</span></div>{additionalChargesSubtotal > 0 && <div className="mt-2 flex justify-between gap-2 text-sm text-white/75"><span>Additional charges</span><span className="tabular-nums">{formatCurrency(additionalChargesSubtotal)}</span></div>}<div className="mt-2 flex justify-between gap-2 text-sm text-white/75"><span>Subtotal{estimatedVat > 0 ? ' (ex VAT)' : ''}</span><span className="tabular-nums">{formatCurrency(total)}</span></div>{estimatedVat > 0 && <><div className="mt-3 space-y-1.5 border-t border-white/15 pt-3 text-xs text-white/70"><p className="font-semibold text-white">VAT breakdown</p>{vatBreakdown.filter(([, amounts]) => amounts.vat > 0).map(([rate, amounts]) => <div key={rate} className="flex justify-between gap-2"><span>VAT at {rate}% on {formatCurrency(amounts.taxable)}</span><span className="shrink-0 tabular-nums">{formatCurrency(roundMoney(amounts.vat))}</span></div>)}</div><div className="mt-2 flex justify-between gap-2 text-sm text-white/75"><span>Total VAT</span><span className="tabular-nums">{formatCurrency(estimatedVat)}</span></div></>}<div className="my-4 border-t border-white/15"/><div className="flex items-end justify-between gap-2"><span className="text-sm font-medium">Total {estimatedVat > 0 ? '(inc VAT)' : ''}</span><strong className="text-xl tabular-nums text-orange-300">{formatCurrency(total + estimatedVat)}</strong></div>{estimatedVat > 0 && <p className="mt-3 text-[11px] leading-relaxed text-white/45">VAT is calculated on each line using its rate, rounded to the nearest penny, then added to the ex VAT subtotal.</p>}</div>
        </div>
      </section>
      {createQuote.isError && <p role="alert" className="text-sm text-red-600">{(createQuote.error as Error).message}</p>}
      </>}
        {validationError && <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{validationError}</p>}
        {step === 1 && productsQuery.isError && <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />Could not load active catalogue products. Please refresh before continuing.</p>}
      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
        {step === 1 ? <Link to="/quotations" className="rounded-lg border px-4 py-2.5 text-center text-sm">Cancel</Link> : <button type="button" onClick={() => setStep(1)} className="rounded-lg border px-4 py-2.5 text-sm">Back to details</button>}
        <button type="submit" disabled={checkingBeforeContinue || (step === 2 && (createQuote.isPending || !selectedLines.length))} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{checkingBeforeContinue ? 'Checking quotation…' : step === 1 ? 'Review quotation' : createQuote.isPending ? 'Submitting…' : editId ? 'Submit changes & download PDF' : 'Submit quotation & download PDF'}</button>
      </div>
    </form>
    {showCustomerForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b px-6 py-4"><div><h2 className="text-lg font-semibold">Add customer</h2><p className="text-sm text-muted-foreground">Create a customer and use them for this quote.</p></div><button type="button" onClick={() => setShowCustomerForm(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
      <form className="space-y-4 p-6" onSubmit={(event) => { event.preventDefault(); createCustomer.mutate() }}>
        <div className="grid grid-cols-2 gap-3"><label><span className="form-label">First name *</span><input required value={newCustomer.firstName} onChange={(event) => setNewCustomer({ ...newCustomer, firstName: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label><label><span className="form-label">Last name *</span><input required value={newCustomer.lastName} onChange={(event) => setNewCustomer({ ...newCustomer, lastName: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label></div>
        <label className="block"><span className="form-label">Email</span><input type="email" value={newCustomer.email} onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label className="block"><span className="form-label">Phone</span><input value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <fieldset className="space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">Customer address</legend><label className="block"><span className="form-label">Address line 1</span><input value={newCustomer.billingAddressLine1} onChange={(event) => setNewCustomer({ ...newCustomer, billingAddressLine1: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label><label className="block"><span className="form-label">Address line 2</span><input value={newCustomer.billingAddressLine2} onChange={(event) => setNewCustomer({ ...newCustomer, billingAddressLine2: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label><div className="grid grid-cols-2 gap-3"><label><span className="form-label">City</span><input value={newCustomer.billingCity} onChange={(event) => setNewCustomer({ ...newCustomer, billingCity: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label><label><span className="form-label">Postcode</span><input value={newCustomer.billingPostcode} onChange={(event) => setNewCustomer({ ...newCustomer, billingPostcode: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label></div><label className="block"><span className="form-label">Country</span><input value={newCustomer.billingCountry} onChange={(event) => setNewCustomer({ ...newCustomer, billingCountry: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label></fieldset>
        {createCustomer.isError && <p className="text-sm text-red-500">{(createCustomer.error as Error).message}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCustomerForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={createCustomer.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">{createCustomer.isPending ? 'Saving...' : 'Save customer'}</button></div>
      </form>
    </div></div>}
  </div>
}
