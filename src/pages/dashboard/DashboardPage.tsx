import { useQuery } from '@tanstack/react-query'
import { Boxes, Factory, FileText, Package, Tags, ArrowUpRight, Clock3, CircleCheck, CircleX, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'

type Breakdown = { label: string; value: string | number; tone?: string }
type DashboardCardProps = {
  title: string
  value: string | number
  description: string
  to: string
  icon: React.ElementType
  color: string
  breakdown: Breakdown[]
  loading?: boolean
}

function DashboardCard({ title, value, description, to, icon: Icon, color, breakdown, loading }: DashboardCardProps) {
  return <Link to={to} className={cn('metric-card group block bg-gradient-to-br focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2', color)}>
    <div className="metric-card-glow" />
    <div className="relative">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 text-primary shadow-sm"><Icon className="h-5 w-5" /></div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      {loading ? <><div className="skeleton mb-2 h-9 w-24" /><div className="skeleton mb-4 h-4 w-36" /></> : <><div className="stat-number mb-0.5 text-foreground">{value}</div><p className="text-sm font-semibold text-foreground">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></>}
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-900/10 pt-3">
        {breakdown.map((item) => <div key={item.label} className="min-w-0"><p className="truncate text-[11px] text-muted-foreground">{item.label}</p><p className={cn('truncate text-sm font-semibold text-foreground', item.tone)}>{loading ? '—' : item.value}</p></div>)}
      </div>
      <p className="mt-4 text-xs font-semibold text-primary">Open {title.toLowerCase()} <span aria-hidden="true">→</span></p>
    </div>
  </Link>
}

type BusinessSummaryCardProps = {
  title: string
  description: string
  to: string
  icon: React.ElementType
  color: string
  loading: boolean
  count: number
  amount: number
  amountLabel: string
  statuses: { label: string; value: number; tone: string; icon: React.ElementType }[]
  financials?: { label: string; amount: number; tone: string; icon: React.ElementType }[]
}

function BusinessSummaryCard({ title, description, to, icon: Icon, color, loading, count, amount, amountLabel, statuses, financials }: BusinessSummaryCardProps) {
  return <Link to={to} className={cn('group relative block overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2', color)}>
    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
    <div className="relative">
      <div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 text-primary shadow-sm"><Icon className="h-5 w-5" /></span><div><h2 className="font-semibold text-foreground">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div></div><ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
      <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-white/70 bg-white/55 p-3.5 backdrop-blur-sm dark:bg-slate-950/20">
        <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total {title.toLowerCase()}</p><p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{loading ? '—' : count.toLocaleString()}</p></div>
        <div className="border-l border-slate-900/10 pl-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{amountLabel}</p><p className="mt-2 break-words text-xl font-bold tracking-tight text-foreground">{loading ? '—' : formatCurrency(amount)}</p></div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {statuses.map(({ label, value, tone, icon: StatusIcon }) => <div key={label} className="rounded-xl border border-white/70 bg-white/60 px-3 py-2.5 dark:bg-slate-950/20"><div className="flex items-center gap-1.5"><StatusIcon className={cn('h-3.5 w-3.5', tone)} /><span className="truncate text-[11px] text-muted-foreground">{label}</span></div><p className={cn('mt-1 text-lg font-bold tabular-nums', tone)}>{loading ? '—' : value.toLocaleString()}</p></div>)}
      </div>
      {financials && <div className="mt-3 grid grid-cols-2 gap-2">{financials.map(({ label, amount: financialAmount, tone, icon: FinancialIcon }) => <div key={label} className="flex items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/60 px-3 py-2.5 dark:bg-slate-950/20"><span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"><FinancialIcon className={cn('h-3.5 w-3.5 shrink-0', tone)} /><span className="truncate">{label}</span></span><strong className={cn('shrink-0 text-sm tabular-nums', tone)}>{loading ? '—' : formatCurrency(financialAmount)}</strong></div>)}</div>}
      <p className="mt-4 text-xs font-semibold text-primary">View {title.toLowerCase()} <span aria-hidden="true">→</span></p>
    </div>
  </Link>
}

function rowsFrom(response: any): any[] {
  return response?.data?.data ?? response?.data ?? []
}

export function DashboardPage() {
  const metricsQuery = useQuery({ queryKey: ['dashboard-metrics'], queryFn: () => api.get('/reports/dashboard') as any, refetchInterval: 1000 * 60 * 5 })
  const typesQuery = useQuery({ queryKey: ['dashboard-product-types'], queryFn: () => api.get('/products/categories/all') as any })
  const manufacturersQuery = useQuery({ queryKey: ['dashboard-manufacturers'], queryFn: () => api.get('/products/brands/all') as any })
  const materialsQuery = useQuery({ queryKey: ['dashboard-materials'], queryFn: () => api.get('/products?limit=200') as any })
  const stockQuery = useQuery({ queryKey: ['dashboard-stock'], queryFn: () => api.get('/inventory/balances?limit=200') as any })
  const metrics = (metricsQuery.data as any)?.data ?? {}
  const types = rowsFrom(typesQuery.data)
  const manufacturers = rowsFrom(manufacturersQuery.data)
  const materials = rowsFrom(materialsQuery.data)
  const stock = rowsFrom(stockQuery.data)
  const quotationSummary = metrics.quotationSummary ?? {}
  const invoiceSummary = metrics.invoiceSummary ?? {}
  const active = (record: any) => record.isActive !== false
  const totalOnHand = stock.reduce((sum, row) => sum + Number(row.quantityOnHand ?? 0), 0)
  const stockItemCount = new Set(stock.filter((row) => Number(row.quantityOnHand ?? 0) > 0).map((row) => row.productId)).size
  const cardLoading = (query: { isLoading: boolean }) => query.isLoading

  return <div className="animate-fade-in space-y-6">
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-5 text-white shadow-lg sm:p-7">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Toggar Heat & Aircon</p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Business overview</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-300">Choose a section to review its current records and activity.</p>
      <p className="mt-4 text-xs text-slate-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <DashboardCard title="Product types" value={types.length} description="Groups used to organise materials" to="/products/types" icon={Tags} color="from-orange-100 to-amber-50 border-orange-200" loading={cardLoading(typesQuery)} breakdown={[{ label: 'Active', value: types.filter(active).length }, { label: 'Inactive', value: types.filter((item) => !active(item)).length }]} />
      <DashboardCard title="Manufacturers" value={manufacturers.length} description="Makes available in the catalogue" to="/products/manufacturers" icon={Factory} color="from-violet-100 to-purple-50 border-violet-200" loading={cardLoading(manufacturersQuery)} breakdown={[{ label: 'Active', value: manufacturers.filter(active).length }, { label: 'Inactive', value: manufacturers.filter((item) => !active(item)).length }]} />
      <DashboardCard title="Materials" value={materials.length} description="Products available for stock and quotes" to="/products" icon={Boxes} color="from-blue-100 to-sky-50 border-blue-200" loading={cardLoading(materialsQuery)} breakdown={[{ label: 'Active', value: materials.filter(active).length }, { label: 'Inactive', value: materials.filter((item) => !active(item)).length }]} />
      <BusinessSummaryCard title="Quotations" description="Quotation amounts and status" to="/quotations" icon={FileText} color="from-emerald-100 via-green-50 to-white border-emerald-200" loading={cardLoading(metricsQuery)} count={Number(quotationSummary.totalCount || 0)} amount={Number(quotationSummary.totalAmount || 0)} amountLabel="Total amount" statuses={[{ label: 'Pending', value: Number(quotationSummary.pendingCount || 0), tone: 'text-amber-700', icon: Clock3 }, { label: 'Confirmed', value: Number(quotationSummary.confirmedCount || 0), tone: 'text-emerald-700', icon: CircleCheck }, { label: 'Rejected', value: Number(quotationSummary.rejectedCount || 0), tone: 'text-rose-700', icon: CircleX }]} />
      <BusinessSummaryCard title="Invoices" description="Invoice status and payment totals" to="/invoices" icon={Wallet} color="from-sky-100 via-blue-50 to-white border-sky-200" loading={cardLoading(metricsQuery)} count={Number(invoiceSummary.totalCount || 0)} amount={Number(invoiceSummary.totalAmount || 0)} amountLabel="Invoice total" statuses={[{ label: 'Unpaid', value: Number(invoiceSummary.unpaidCount || 0), tone: 'text-amber-700', icon: Clock3 }, { label: 'Part paid', value: Number(invoiceSummary.partiallyPaidCount || 0), tone: 'text-sky-700', icon: Wallet }, { label: 'Fully paid', value: Number(invoiceSummary.fullyPaidCount || 0), tone: 'text-emerald-700', icon: CircleCheck }]} financials={[{ label: 'Received', amount: Number(invoiceSummary.receivedAmount || 0), tone: 'text-emerald-700', icon: CircleCheck }, { label: 'Due', amount: Number(invoiceSummary.dueAmount || 0), tone: 'text-orange-700', icon: Clock3 }]} />
      <DashboardCard title="Stock" value={`${totalOnHand.toLocaleString()} units`} description="Current quantity across locations" to="/stock" icon={Package} color="from-rose-100 to-orange-50 border-rose-200" loading={cardLoading(stockQuery)} breakdown={[{ label: 'Products in stock', value: stockItemCount }, { label: 'Low stock products', value: metrics.lowStockProducts ?? 0, tone: Number(metrics.lowStockProducts) > 0 ? 'text-red-600' : '' }]} />
    </div>
  </div>
}
