import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownToLine, Package, Plus, Search, X, Pencil, Trash2, Eye } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { ExportActions } from '@/components/common/ExportActions'
import { Pagination, useClientPagination } from '@/components/common/Pagination'

export function StockPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [adjusting, setAdjusting] = useState(false)
  const [editingBalance, setEditingBalance] = useState<any | null>(null)
  const [historyBalance, setHistoryBalance] = useState<any | null>(null)
  const [stockActionError, setStockActionError] = useState('')
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false)
  const [materialSearch, setMaterialSearch] = useState('')
  const [form, setForm] = useState({ productId: '', locationId: '', quantity: '', unitCost: '', reason: 'Stock count adjustment', notes: '' })
  const [operation, setOperation] = useState<'receive' | 'adjust'>('receive')
  const balancesQuery = useQuery({ queryKey: ['stock-balances', search], queryFn: () => api.get(`/inventory/balances?limit=200&search=${encodeURIComponent(search)}`) as any })
  const productsQuery = useQuery({ queryKey: ['stock-products'], queryFn: () => api.get('/products?limit=200') as any })
  const locationsQuery = useQuery({ queryKey: ['stock-locations'], queryFn: () => api.get('/inventory/locations') as any })
  const historyQuery = useQuery({
    queryKey: ['stock-movements', historyBalance?.productId],
    queryFn: () => api.get(`/inventory/movements?productId=${encodeURIComponent(historyBalance.productId)}&limit=200`) as any,
    enabled: !!historyBalance,
  })

  const balances = (balancesQuery.data as any)?.data?.data ?? []
  const products = (productsQuery.data as any)?.data?.data ?? []
  const activeProducts = products.filter((product: any) => product.isActive !== false)
  const selectedMaterial = products.find((product: any) => String(product.id) === String(form.productId))
  const filteredMaterials = activeProducts.filter((product: any) => [product.name, product.sku, product.modelNumber, product.manufacturer, product.brand?.name].filter(Boolean).join(' ').toLowerCase().includes(materialSearch.trim().toLowerCase()))
  const locations = (locationsQuery.data as any)?.data ?? []
  useEffect(() => {
    if (!adjusting || editingBalance || form.locationId || !locations.length) return
    const defaultLocation = locations.find((location: any) => location.isDefault) || locations[0]
    setForm((current) => ({ ...current, locationId: defaultLocation.id }))
  }, [adjusting, editingBalance, form.locationId, locations])
  const visibleBalances = balances.filter((row: any) => {
    if (Number(row.quantityOnHand ?? 0) <= 0 && Number(row.quantityReserved ?? 0) <= 0) return false
    const active = row.product?.isActive !== false
    return (statusFilter === 'all' || (statusFilter === 'active' ? active : !active))
      && (locationFilter === 'all' || row.locationId === locationFilter || row.location?.id === locationFilter)
  })
  const paginatedBalances = useClientPagination(visibleBalances, page, pageSize)
  const totalQuantity = useMemo(() => visibleBalances.reduce((sum: number, row: any) => sum + Number(row.quantityOnHand ?? 0), 0), [visibleBalances])

  const saveStock = useMutation({
    mutationFn: async () => {
      const quantity = Number(form.quantity)
      if (editingBalance) {
        const delta = quantity - Number(editingBalance.quantityOnHand ?? 0)
        if (delta === 0) return null
        return api.post('/inventory/adjust', { productId: editingBalance.productId, locationId: editingBalance.locationId, quantity: delta, reason: 'Stock quantity edited', notes: form.notes })
      }
      if (operation === 'receive') {
        return api.post('/inventory/receive', { productId: form.productId, locationId: form.locationId, quantity, unitCost: form.unitCost !== '' ? Number(form.unitCost) : undefined, notes: form.notes })
      }
      return api.post('/inventory/adjust', { productId: form.productId, locationId: form.locationId, quantity, reason: form.reason, notes: form.notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] })
      queryClient.invalidateQueries({ queryKey: ['material-balances'] })
      queryClient.invalidateQueries({ queryKey: ['stock-products'] })
      queryClient.invalidateQueries({ queryKey: ['quotation-invoice-stock-check'] })
      setAdjusting(false)
      setEditingBalance(null)
      setForm({ productId: '', locationId: '', quantity: '', unitCost: '', reason: 'Stock count adjustment', notes: '' })
    },
  })
  const deleteBalance = useMutation({
    mutationFn: async (balance: any) => api.post('/inventory/adjust', {
      productId: balance.productId,
      locationId: balance.locationId,
      quantity: -Number(balance.quantityOnHand ?? 0),
      reason: 'Stock balance deleted',
      notes: 'Quantity removed using an audited stock adjustment.',
    }),
    onSuccess: () => {
      setStockActionError('')
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] })
      queryClient.invalidateQueries({ queryKey: ['material-balances'] })
      queryClient.invalidateQueries({ queryKey: ['quotation-invoice-stock-check'] })
    },
    onError: (error) => setStockActionError((error as Error).message || 'Could not remove this stock balance.'),
  })

  const openForm = (type: 'receive' | 'adjust') => {
    setEditingBalance(null)
    setOperation(type)
    setMaterialPickerOpen(false)
    setMaterialSearch('')
    setForm((current) => ({ ...current, locationId: locations.find((location: any) => location.isDefault)?.id ?? locations[0]?.id ?? '' }))
    setAdjusting(true)
  }

  const editBalance = (balance: any) => {
    setEditingBalance(balance)
    setOperation('adjust')
    setForm({ productId: balance.productId, locationId: balance.locationId, quantity: String(balance.quantityOnHand ?? 0), unitCost: '', reason: 'Stock count adjustment', notes: '' })
    setAdjusting(true)
  }

  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="page-header mb-0"><h1 className="page-title">Stock levels</h1><p className="page-description">{visibleBalances.length} product/location balances · {totalQuantity.toLocaleString()} units on hand</p></div>
      <div className="flex flex-col gap-2 sm:flex-row"><ExportActions title="Stock levels" columns={[{ label: 'Manufacturer', value: (row: any) => row.product?.manufacturer || row.product?.brand?.name }, { label: 'Model', value: (row: any) => row.product?.modelNumber }, { label: 'Product code', value: (row: any) => row.product?.sku }, { label: 'Material', value: (row: any) => row.product?.name }, { label: 'Location', value: (row: any) => row.location?.name }, { label: 'Quantity on hand', value: (row: any) => Number(row.quantityOnHand ?? 0) }, { label: 'Weighted average cost ex VAT', value: (row: any) => Number(row.product?.purchasePrice ?? 0).toFixed(2) }, { label: 'Status', value: (row: any) => row.product?.isActive === false ? 'Inactive' : 'Active' }]} rows={visibleBalances} />
        <button onClick={() => openForm('receive')} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm"><ArrowDownToLine className="h-4 w-4" />Add stock</button>
      </div>
    </div>
    {stockActionError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{stockActionError}</span><button type="button" aria-label="Dismiss error" onClick={() => setStockActionError('')}><X className="h-4 w-4" /></button></div>}

    <div className="section-card flex flex-col gap-3 p-4 lg:flex-row"><div className="relative w-full max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search make, model, code or description..." className="min-h-11 w-full rounded-lg border bg-muted/30 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div><div className="flex flex-col gap-3 sm:flex-row"><select aria-label="Filter stock by product status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1) }} className="min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">All product statuses</option><option value="active">Active products</option><option value="inactive">Inactive products</option></select><select aria-label="Filter stock by location" value={locationFilter} onChange={(event) => { setLocationFilter(event.target.value); setPage(1) }} className="min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">All locations</option>{locations.map((location: any) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div></div>

    <div className="section-card overflow-hidden">
      {balancesQuery.isLoading ? <div className="p-10 text-center text-muted-foreground">Loading stock...</div>
        : balancesQuery.isError ? <div className="p-10 text-center text-red-500">Could not load stock balances. Check the API connection and your stock permissions.</div>
        : visibleBalances.length === 0 ? <div className="p-12 text-center"><Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">No stock matches these filters</p><p className="mt-1 text-sm text-muted-foreground/60">Change the filters or receive stock to create a balance.</p></div>
        : <div className="overflow-x-auto"><table className="data-table min-w-[900px]">
          <thead><tr><th>Manufacturer / Make</th><th>Model</th><th>Product Code</th><th>Material Description</th><th>Location</th><th className="text-right">Quantity</th><th className="text-right">Weighted Avg Unit Price (ex VAT)</th><th>Actions</th></tr></thead>
          <tbody>{paginatedBalances.rows.map((balance: any) => <tr key={balance.id}>
            <td className="font-medium">{balance.product?.manufacturer || balance.product?.brand?.name || '—'}</td><td className="font-mono text-xs">{balance.product?.modelNumber || '—'}</td><td className="font-mono text-xs">{balance.product?.sku || '—'}</td>
            <td><p className="font-medium">{balance.product?.name || '—'}</p><p className="max-w-lg truncate text-xs text-muted-foreground">{balance.product?.description || ''}</p></td>
            <td className="text-sm">{balance.location?.name || '—'}</td><td className="text-right font-semibold tabular-nums">{Number(balance.quantityOnHand ?? 0).toLocaleString()}</td><td className="text-right tabular-nums">{formatCurrency(Number(balance.product?.purchasePrice ?? 0))}</td><td><div className="flex items-center"><button type="button" onClick={() => setHistoryBalance(balance)} title="View stock history" aria-label={`View stock history for ${balance.product?.name || 'product'}`} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><Eye className="h-4 w-4" /></button><button type="button" onClick={() => editBalance(balance)} title="Edit stock quantity" aria-label={`Edit ${balance.product?.name || 'stock'} quantity at ${balance.location?.name || 'location'}`} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button><button type="button" disabled={deleteBalance.isPending} onClick={() => { const label = balance.product?.name || 'this stock'; if (window.confirm(`Remove all ${Number(balance.quantityOnHand ?? 0)} available units of ${label} from ${balance.location?.name || 'this location'}? This will be recorded in the stock ledger.`)) deleteBalance.mutate(balance) }} title="Delete stock balance" aria-label={`Delete ${balance.product?.name || 'stock'} balance`} className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></div></td>
          </tr>)}</tbody>
        </table></div>}
      {!balancesQuery.isLoading && !balancesQuery.isError && visibleBalances.length > 0 && <Pagination page={paginatedBalances.page} pageSize={pageSize} total={visibleBalances.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
    </div>

    {historyBalance && createPortal(<div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryBalance(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="stock-history-title" className="flex max-h-[92dvh] w-full max-w-5xl flex-col rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b px-4 py-4 sm:px-6"><div><h2 id="stock-history-title" className="text-lg font-semibold">Stock history</h2><p className="text-sm text-muted-foreground">{historyBalance.product?.name || 'Product'} · {historyBalance.product?.modelNumber || historyBalance.product?.sku || 'No model/code'}</p></div><button type="button" onClick={() => setHistoryBalance(null)} aria-label="Close stock history" className="rounded-lg p-2 hover:bg-accent"><X className="h-5 w-5" /></button></header>
        <div className="overflow-auto p-4 sm:p-6">
          {historyQuery.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading stock history…</p>
            : historyQuery.isError ? <p role="alert" className="p-8 text-center text-sm text-red-600">Could not load stock history.</p>
            : (() => {
              const entries = (historyQuery.data as any)?.data?.data ?? []
              const movementLabels: Record<string, string> = { received: 'Stock added', adjustment_in: 'Quantity increased', adjustment_out: 'Quantity reduced', returned: 'Stock returned', issued: 'Stock issued', damaged: 'Stock damaged', transfer_in: 'Transfer in', transfer_out: 'Transfer out', reserved: 'Reserved', reservation_released: 'Reservation released' }
              const outgoing = new Set(['adjustment_out', 'issued', 'damaged', 'transfer_out'])
              return entries.length === 0 ? <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No stock movements recorded for this product yet.</p>
                : <div className="overflow-x-auto rounded-xl border"><table className="data-table min-w-[760px]"><thead><tr><th>Date</th><th>Change</th><th className="text-right">Quantity</th><th>Location</th><th>Unit cost</th><th>Notes</th><th>Changed by</th></tr></thead><tbody>{entries.map((movement: any) => <tr key={movement.id}><td className="whitespace-nowrap text-sm">{new Date(movement.createdAt).toLocaleString()}</td><td className="font-medium">{movementLabels[movement.type] || movement.type}</td><td className={`text-right font-semibold tabular-nums ${outgoing.has(movement.type) ? 'text-red-600' : 'text-emerald-700'}`}>{outgoing.has(movement.type) ? '−' : '+'}{Number(movement.quantity ?? 0).toLocaleString()}</td><td>{movement.location?.name || '—'}</td><td>{movement.unitCost == null ? '—' : formatCurrency(Number(movement.unitCost))}</td><td className="max-w-xs whitespace-pre-wrap text-sm">{movement.notes || '—'}</td><td className="text-sm">{movement.createdBy?.firstName ? `${movement.createdBy.firstName} ${movement.createdBy.lastName || ''}`.trim() : '—'}</td></tr>)}</tbody></table></div>
            })()}
        </div>
      </section>
    </div>, document.body)}

    {adjusting && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setAdjusting(false); setEditingBalance(null) } }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4"><div><h2 className="text-lg font-semibold">{editingBalance ? 'Edit stock quantity' : operation === 'receive' ? 'Receive stock' : 'Adjust stock'}</h2><p className="text-sm text-muted-foreground">Stock changes are recorded in the movement ledger.</p></div><button onClick={() => { setAdjusting(false); setEditingBalance(null) }} aria-label="Close"><X className="h-5 w-5" /></button></div>
        <form className="space-y-4 p-6" onSubmit={(event) => { event.preventDefault(); saveStock.mutate() }}>
          <label className="relative block"><span className="form-label">Material *</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input required={!editingBalance && !form.productId} disabled={!!editingBalance} role="combobox" aria-autocomplete="list" aria-expanded={materialPickerOpen} aria-controls="stock-material-options" autoComplete="off" value={materialPickerOpen ? materialSearch : selectedMaterial ? `${selectedMaterial.name}${selectedMaterial.sku ? ` · ${selectedMaterial.sku}` : ''}` : ''} onFocus={() => { if (!editingBalance) { setMaterialPickerOpen(true); setMaterialSearch('') } }} onBlur={() => window.setTimeout(() => setMaterialPickerOpen(false), 120)} onKeyDown={(event) => { if (event.key === 'Escape') setMaterialPickerOpen(false); if (event.key === 'Enter' && materialPickerOpen && filteredMaterials[0]) { event.preventDefault(); const product = filteredMaterials[0]; setForm((current) => ({ ...current, productId: product.id, unitCost: product.purchasePrice != null ? String(product.purchasePrice) : '' })); setMaterialPickerOpen(false); setMaterialSearch('') } }} onChange={(event) => { setMaterialSearch(event.target.value); setMaterialPickerOpen(true); setForm((current) => ({ ...current, productId: '' })) }} placeholder="Search materials by name, code, or model…" className="min-h-11 w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm disabled:opacity-70" />{materialPickerOpen && <div id="stock-material-options" role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">{productsQuery.isLoading ? <p className="px-3 py-2 text-sm text-muted-foreground">Loading materials…</p> : filteredMaterials.length ? filteredMaterials.map((product: any) => <button key={product.id} type="button" role="option" aria-selected={String(product.id) === String(form.productId)} onMouseDown={(event) => event.preventDefault()} onClick={() => { setForm((current) => ({ ...current, productId: product.id, unitCost: product.purchasePrice != null ? String(product.purchasePrice) : '' })); setMaterialPickerOpen(false); setMaterialSearch('') }} className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-slate-100"><span className="font-medium">{product.name}{product.sku && <span className="ml-2 font-mono text-xs text-muted-foreground">{product.sku}</span>}</span>{(product.manufacturer || product.brand?.name || product.modelNumber) && <span className="text-xs text-muted-foreground">{[product.manufacturer || product.brand?.name, product.modelNumber].filter(Boolean).join(' · ')}</span>}</button>) : <p className="px-3 py-2 text-sm text-muted-foreground">No active materials found.</p>}</div>}</div></label>
          <label className="block"><span className="form-label">{editingBalance ? 'New quantity on hand *' : operation === 'receive' ? 'Quantity to receive *' : 'Quantity adjustment * (negative removes stock)'}</span><input required min={editingBalance ? 0 : undefined} type="number" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          {operation === 'adjust' && !editingBalance && <label className="block"><span className="form-label">Reason *</span><input required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>}
          <label className="block"><span className="form-label">Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          {saveStock.isError && <p className="flex items-center gap-2 text-sm text-red-500"><AlertTriangle className="h-4 w-4" />{(saveStock.error as Error).message}</p>}
          {!editingBalance && !form.locationId && !locationsQuery.isLoading && <p role="alert" className="text-sm text-red-600">Create a stock location before receiving stock.</p>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setAdjusting(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saveStock.isPending || (!editingBalance && !form.locationId)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saveStock.isPending ? 'Saving...' : 'Save movement'}</button></div>
        </form>
      </div>
    </div>, document.body)}
  </div>
}
