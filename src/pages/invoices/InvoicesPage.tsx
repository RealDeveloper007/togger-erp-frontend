import { useMemo, useState } from 'react'
import { CreditCard, Download, Eye, FileText, Loader2, RotateCcw, Search, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatCurrency, formatDate, formatCustomerName, formatReferenceNumber } from '@/lib/utils'
import { Pagination, useClientPagination } from '@/components/common/Pagination'

const customerName = (customer: any) => formatCustomerName(customer?.companyName || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || '—')
const customerCode = (customer: any) => customer?.customerCode || customer?.customer_code || ''
const customerDetails = (customer: any) => [customer?.email, customer?.phone || customer?.mobile, [customer?.billingAddressLine1, customer?.billingAddressLine2, customer?.billingCity, customer?.billingPostcode, customer?.billingCountry].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
const invoiceStatusLabel = (invoice: any) => {
  if (invoice?.status === 'cancelled') return 'Cancelled'
  if (Number(invoice?.amountOutstanding || 0) <= 0 && Number(invoice?.grandTotal || 0) > 0) return 'Fully paid'
  if (Number(invoice?.amountPaid || 0) > 0) return 'Partially paid'
  if (invoice?.status === 'sent') return 'Unpaid'
  return String(invoice?.status || 'draft').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
const invoiceStatusValue = (invoice: any) => {
  if (invoice?.status === 'cancelled') return 'cancelled'
  if (Number(invoice?.amountOutstanding || 0) <= 0 && Number(invoice?.grandTotal || 0) > 0) return 'paid'
  if (Number(invoice?.amountPaid || 0) > 0) return 'partially_paid'
  return invoice?.status === 'sent' ? 'sent' : invoice?.status
}
const invoiceStatusClass = (invoice: any) => {
  const label = invoiceStatusLabel(invoice)
  if (label === 'Fully paid') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (label === 'Partially paid') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (label === 'Unpaid') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (label === 'Overdue') return 'border-rose-200 bg-rose-50 text-rose-800'
  if (label === 'Cancelled') return 'border-slate-200 bg-slate-100 text-slate-600'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}
const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function downloadInvoicePdf(id: string, quotationNumber?: string) {
  const response: any = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
  const blob = response instanceof Blob ? response : new Blob([response], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `invoice-${quotationNumber || 'quotation'}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function openPaymentReceipt(paymentId: string) {
  const receiptWindow = window.open('about:blank', '_blank')
  try {
    const response: any = await api.get(`/invoices/payments/${paymentId}/attachment`, { responseType: 'blob' })
    const blob = response instanceof Blob ? response : new Blob([response])
    const url = URL.createObjectURL(blob)
    if (receiptWindow) receiptWindow.location.href = url
    else window.location.href = url
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    receiptWindow?.close()
    window.alert((error as Error).message || 'Could not open the payment receipt.')
  }
}

export function InvoicesPage() {
  const queryClient = useQueryClient()
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
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null)
  const [invoiceDialogMode, setInvoiceDialogMode] = useState<'view' | 'payment'>('view')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const invoicesQuery = useQuery({
    queryKey: ['invoices', search],
    queryFn: () => api.get(`/invoices?limit=200&search=${encodeURIComponent(search)}`) as any,
  })
  const invoices = (invoicesQuery.data as any)?.data?.data ?? []
  const customers = useMemo(() => [...new Map(invoices.map((invoice: any) => [String(invoice.customerId), invoice.customer]).filter(([, customer]: any) => customer?.id)).values()] as any[], [invoices])
  const filteredInvoices = useMemo(() => invoices.filter((invoice: any) => {
    const total = Number(invoice.grandTotal || 0)
    const invoiceDate = String(invoice.invoiceDate || '').slice(0, 10)
    return (!quotationFilter.trim() || String(invoice.quotation?.quotationNumber || '').toLowerCase().includes(quotationFilter.trim().toLowerCase()))
      && (customerFilter === 'all' || String(invoice.customerId) === customerFilter)
      && (statusFilter === 'all' || invoiceStatusValue(invoice) === statusFilter)
      && (!dateFrom || invoiceDate >= dateFrom)
      && (!dateTo || invoiceDate <= dateTo)
      && (!priceMin || total >= Number(priceMin))
      && (!priceMax || total <= Number(priceMax))
  }), [invoices, quotationFilter, customerFilter, statusFilter, dateFrom, dateTo, priceMin, priceMax])
  const paginatedInvoices = useClientPagination(filteredInvoices, page, pageSize)
  const paymentQuery = useQuery({ queryKey: ['invoice-payment-detail', paymentInvoiceId], queryFn: () => api.get(`/invoices/${paymentInvoiceId}`) as any, enabled: !!paymentInvoiceId })
  const selectedInvoice = (paymentQuery.data as any)?.data ?? paymentQuery.data
  const outstanding = Number(selectedInvoice?.amountOutstanding || 0)
  const paymentAmountValue = Number(paymentAmount || 0)
  const validPayment = Number.isFinite(paymentAmountValue) && paymentAmountValue > 0 && paymentAmountValue <= outstanding
  const recordPayment = useMutation({
    mutationFn: () => {
      const payload = new FormData()
      payload.append('amount', String(paymentAmountValue))
      payload.append('paymentDate', paymentDate)
      payload.append('method', paymentMethod)
      if (paymentReceipt) payload.append('paymentReceipt', paymentReceipt)
      return api.post(`/invoices/${paymentInvoiceId}/payments`, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['invoice-payment-detail', paymentInvoiceId] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      setPaymentAmount('')
      setPaymentReceipt(null)
    },
    onError: (error) => window.alert((error as Error).message || 'Could not save payment.'),
  })
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
  const openPayment = (invoiceId: string) => {
    setInvoiceDialogMode('payment')
    setPaymentInvoiceId(invoiceId)
    setPaymentAmount('')
    setPaymentDate(today())
    setPaymentMethod('bank_transfer')
    setPaymentReceipt(null)
  }
  const openInvoiceView = (invoiceId: string) => {
    setInvoiceDialogMode('view')
    setPaymentInvoiceId(invoiceId)
  }

  return <div className="space-y-6 animate-fade-in">
    <div className="page-header mb-0"><h1 className="page-title">Invoices</h1><p className="page-description">Invoices created from confirmed quotations.</p></div>
    <div className="section-card space-y-3 p-4">
      <div className="relative w-full max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search customer or quotation…" className="min-h-11 w-full rounded-lg border bg-muted/30 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-muted-foreground">Quotation number<input value={quotationFilter} onChange={(event) => { setQuotationFilter(event.target.value); setPage(1) }} placeholder="e.g. TOG-1001" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <label className="text-xs font-medium text-muted-foreground">Customer<select value={customerFilter} onChange={(event) => { setCustomerFilter(event.target.value); setPage(1) }} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground"><option value="all">All customers</option>{customers.map((customer: any) => <option key={customer.id} value={customer.id}>{customerName(customer)}{customerCode(customer) ? ` · ${customerCode(customer)}` : ''}</option>)}</select></label>
        <label className="text-xs font-medium text-muted-foreground">Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal capitalize text-foreground"><option value="all">All statuses</option>{['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'].map((status) => <option key={status} value={status}>{status === 'paid' ? 'Fully paid' : status === 'sent' ? 'Unpaid' : status.replace(/_/g, ' ')}</option>)}</select></label>
        <label className="text-xs font-medium text-muted-foreground">Invoice date from<input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <label className="text-xs font-medium text-muted-foreground">Invoice date to<input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <label className="text-xs font-medium text-muted-foreground">Total from (£)<input type="number" min="0" value={priceMin} onChange={(event) => { setPriceMin(event.target.value); setPage(1) }} placeholder="0.00" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <label className="text-xs font-medium text-muted-foreground">Total to (£)<input type="number" min="0" value={priceMax} onChange={(event) => { setPriceMax(event.target.value); setPage(1) }} placeholder="Any" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
        <div className="flex items-end"><button type="button" onClick={resetFilters} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-accent"><RotateCcw className="h-4 w-4" />Reset filters</button></div>
      </div>
    </div>
    <div className="section-card overflow-hidden">
      {invoicesQuery.isLoading ? <p className="p-10 text-center text-sm text-muted-foreground">Loading invoices…</p>
        : invoicesQuery.isError ? <p role="alert" className="p-10 text-center text-sm text-red-600">Could not load invoices.</p>
          : filteredInvoices.length === 0 ? <div className="p-12 text-center"><FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{invoices.length ? 'No invoices match these filters' : 'No invoices yet'}</p><p className="mt-1 text-sm text-muted-foreground/70">{invoices.length ? 'Change a filter to see matching invoices.' : 'Confirm a quotation to create its invoice.'}</p></div>
            : <><div className="overflow-x-auto"><table className="data-table min-w-[1050px]"><thead><tr><th>Quotation</th><th>Customer</th><th>Invoice / due date</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Received payment</th><th className="text-right">Due payment</th><th>Actions</th></tr></thead><tbody>{paginatedInvoices.rows.map((invoice: any) => {
              const customer = invoice.customer
              const code = customerCode(customer)
              return <tr key={invoice.id}><td className="font-mono text-sm font-semibold">{invoice.quotation?.quotationNumber || '—'}{invoice.quotation?.referenceNumber && <span className="mt-0.5 block font-sans text-xs font-normal text-muted-foreground">Ref: {formatReferenceNumber(invoice.quotation.referenceNumber)}</span>}</td><td><span title={customerDetails(customer) || 'Customer details unavailable'} className="cursor-help">{customerName(customer)}</span><span className="mt-0.5 block text-xs text-muted-foreground">{code || 'Customer ID unavailable'}</span></td><td>{formatDate(invoice.invoiceDate)}<span className="mt-0.5 block text-xs text-muted-foreground">Due {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</span></td><td><span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${invoiceStatusClass(invoice)}`}>{invoiceStatusLabel(invoice)}</span></td><td className="text-right font-semibold tabular-nums">{formatCurrency(Number(invoice.grandTotal || 0))}</td><td className="text-right font-semibold tabular-nums text-emerald-700">{formatCurrency(Number(invoice.amountPaid || 0))}</td><td className="text-right font-semibold tabular-nums text-rose-700">{formatCurrency(Number(invoice.amountOutstanding || 0))}</td><td><div className="flex items-center gap-1"><button type="button" title="View invoice details" aria-label={`View invoice for quotation ${invoice.quotation?.quotationNumber || ''}`} onClick={() => openInvoiceView(String(invoice.id))} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"><Eye className="h-4 w-4" /></button><button type="button" title="Download invoice PDF" aria-label={`Download PDF for quotation ${invoice.quotation?.quotationNumber || ''}`} disabled={downloadingId === String(invoice.id)} onClick={async () => { setDownloadingId(String(invoice.id)); try { await downloadInvoicePdf(String(invoice.id), invoice.quotation?.quotationNumber) } catch (error) { window.alert((error as Error).message || 'Could not download invoice PDF.') } finally { setDownloadingId(null) } }} className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-50">{downloadingId === String(invoice.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button>{Number(invoice.amountOutstanding || 0) > 0 && invoice.status !== 'cancelled' && <button type="button" onClick={() => openPayment(String(invoice.id))} title="Receive payment and view payment history" className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-primary hover:bg-primary/10"><CreditCard className="h-4 w-4" />Payment</button>}</div></td></tr>
            })}</tbody></table></div><Pagination page={paginatedInvoices.page} pageSize={pageSize} total={filteredInvoices.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} /></>}
    </div>
    {paymentInvoiceId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !recordPayment.isPending) setPaymentInvoiceId(null) }}><section role="dialog" aria-modal="true" aria-labelledby="invoice-dialog-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-card shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{invoiceDialogMode === 'view' ? 'Invoice details' : 'Invoice payments'}</p><h2 id="invoice-dialog-title" className="text-lg font-semibold">Invoice {selectedInvoice?.invoiceNumber || '—'}{selectedInvoice?.quotation?.quotationNumber ? <span className="ml-2 text-sm font-normal text-muted-foreground">· {selectedInvoice.quotation.quotationNumber}</span> : null}</h2></div><button type="button" onClick={() => setPaymentInvoiceId(null)} aria-label="Close invoice" className="rounded-lg p-2 hover:bg-accent"><X className="h-5 w-5" /></button></div>{paymentQuery.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading invoice details…</p> : paymentQuery.isError || !selectedInvoice ? <p role="alert" className="p-6 text-sm text-red-600">Could not load this invoice.</p> : <div className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border bg-muted/20 p-3"><span className="text-xs text-muted-foreground">Invoice total</span><strong className="mt-1 block">{formatCurrency(Number(selectedInvoice.grandTotal || 0))}</strong></div><div className="rounded-xl border bg-emerald-50/70 p-3"><span className="text-xs text-emerald-800">Received payment</span><strong className="mt-1 block text-emerald-800">{formatCurrency(Number(selectedInvoice.amountPaid || 0))}</strong></div><div className="rounded-xl border bg-rose-50/70 p-3"><span className="text-xs text-rose-800">Due payment</span><strong className="mt-1 block text-rose-800">{formatCurrency(outstanding)}</strong></div><div className="rounded-xl border p-3"><span className="text-xs text-muted-foreground">Status</span><span className={`mt-1 inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${invoiceStatusClass(selectedInvoice)}`}>{invoiceStatusLabel(selectedInvoice)}</span></div></div><div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p><p className="mt-1 font-semibold">{customerName(selectedInvoice.customer)}</p><p className="text-xs text-muted-foreground">{customerCode(selectedInvoice.customer)}</p><p className="mt-1 text-sm text-muted-foreground">{customerDetails(selectedInvoice.customer) || 'No further customer details'}</p></div><div className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dates & reference</p><p className="mt-1 text-sm">Invoice date: <strong>{formatDate(selectedInvoice.invoiceDate)}</strong></p><p className="text-sm">Due date: <strong>{selectedInvoice.dueDate ? formatDate(selectedInvoice.dueDate) : '—'}</strong></p><p className="text-sm">Reference: <strong>{formatReferenceNumber(selectedInvoice.quotation?.referenceNumber) || '—'}</strong></p></div></div><div><h3 className="mb-2 font-semibold">Invoice items</h3>{(selectedInvoice.lines || []).length ? <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[420px] text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-3">Description</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{selectedInvoice.lines.map((line: any) => <tr key={line.id} className="border-t"><td className="p-3">{line.description}</td><td className="p-3 text-right tabular-nums">{Number(line.quantity).toLocaleString()}</td><td className="p-3 text-right tabular-nums">{formatCurrency(Number(line.lineTotal || 0))}</td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">No invoice items.</p>}</div>{selectedInvoice.notes && <div className="rounded-xl border bg-muted/20 p-4"><h3 className="mb-1 font-semibold">Additional details</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selectedInvoice.notes}</p></div>}{invoiceDialogMode === 'payment' && outstanding > 0 && selectedInvoice.status !== 'cancelled' && <form onSubmit={(event) => { event.preventDefault(); if (validPayment) recordPayment.mutate() }} className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">Record a payment</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Payment amount<input required type="number" min="0.01" max={outstanding} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="0.00" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm" /></label><label className="text-sm">Payment date<input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm" /></label><label className="text-sm">Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm">{[['bank_transfer', 'Bank transfer'], ['cash', 'Cash'], ['card', 'Card'], ['cheque', 'Cheque'], ['other', 'Other']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Attach receipt (optional)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setPaymentReceipt(event.target.files?.[0] || null)} className="mt-1 block min-h-10 w-full rounded-lg border bg-background px-2 py-1.5 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium" /><span className="mt-0.5 block text-[10px] text-muted-foreground">PDF, JPG, PNG, or WebP · up to 10 MB</span></label></div><div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"><span>Due after this payment</span><strong>{formatCurrency(Math.max(0, outstanding - (Number.isFinite(paymentAmountValue) ? paymentAmountValue : 0)))}</strong></div><button type="submit" disabled={!validPayment || recordPayment.isPending} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">{recordPayment.isPending ? 'Saving payment…' : 'Save payment'}</button></form>}<div><h3 className="mb-2 font-semibold">Payment history</h3>{(selectedInvoice.payments || []).length === 0 ? <p className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">No payments recorded yet.</p> : <div className="divide-y rounded-lg border">{selectedInvoice.payments.map((payment: any) => <div key={payment.id} className="flex items-center justify-between gap-3 p-3 text-sm"><div><p className="font-medium">{formatDate(payment.paymentDate)} · {String(payment.method).replace(/_/g, ' ')}</p>{payment.referenceNumber && <p className="text-xs text-muted-foreground">Ref: {payment.referenceNumber}</p>}{payment.attachmentKey && <button type="button" onClick={() => void openPaymentReceipt(String(payment.id))} className="mt-1 inline-flex text-xs font-medium text-primary underline">View receipt</button>}</div><strong>{formatCurrency(Number(payment.amount || 0))}</strong></div>)}</div>}</div></div>}</section></div>}
  </div>
}
