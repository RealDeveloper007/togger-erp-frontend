import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package, RefreshCw, X, Power, Pencil, Trash2, Eye, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { ExportActions } from '@/components/common/ExportActions'
import { Pagination, useClientPagination } from '@/components/common/Pagination'

function responseList(value: any): any[] {
  let rows = value
  for (let depth = 0; depth < 5 && rows; depth += 1) {
    if (Array.isArray(rows)) return rows
    rows = rows.data ?? rows.items ?? rows.results
  }
  return []
}

export function MaterialsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [manufacturerFilter, setManufacturerFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [viewingProduct, setViewingProduct] = useState<any | null>(null)
  const [form, setForm] = useState({ manufacturer: '', brandId: '', categoryId: '', modelNumber: '', sku: '', name: '', description: '', purchasePrice: '' })
  const queryClient = useQueryClient()
  const { data: manufacturersData, refetch: refetchManufacturers } = useQuery({ queryKey: ['brands'], queryFn: () => api.get('/products/brands/all') as any, refetchOnMount: 'always' })
  const { data: typesData, isLoading: isLoadingTypes, isError: isTypesError, refetch: refetchTypes } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/products/categories/all') as any, refetchOnMount: 'always' })
  const manufacturers = responseList(manufacturersData)
  const productTypes = responseList(typesData)
  const activeManufacturers = manufacturers.filter((item: any) => item.isActive !== false)
  const activeProductTypes = productTypes.filter((item: any) => item.isActive !== false)
  useEffect(() => {
    if (!editingProduct || manufacturers.length === 0) return
    if (form.brandId && manufacturers.some((item: any) => item.id === form.brandId)) return
    const manufacturerName = editingProduct.manufacturer || editingProduct.brand?.name
    if (!manufacturerName) return
    const match = manufacturers.find((item: any) => item.name?.trim().toLowerCase() === manufacturerName.trim().toLowerCase())
    if (match) setForm((current) => ({ ...current, brandId: match.id }))
  }, [editingProduct, form.brandId, manufacturers])
  const { data, isLoading, isError } = useQuery({
    queryKey: ['materials', search],
    queryFn: () => api.get(`/products?limit=200&search=${encodeURIComponent(search)}`) as any,
  })
  const { data: balancesData } = useQuery({
    queryKey: ['material-balances'],
    queryFn: () => api.get('/inventory/balances?limit=200') as any,
  })

  const products = responseList(data)
  const visibleProducts = products.filter((product: any) => (statusFilter === 'all' || (statusFilter === 'active' ? product.isActive !== false : product.isActive === false))
    && (manufacturerFilter === 'all' || product.brandId === manufacturerFilter || product.brand?.id === manufacturerFilter)
    && (typeFilter === 'all' || product.categoryId === typeFilter || product.category?.id === typeFilter))
  const paginatedProducts = useClientPagination(visibleProducts, page, pageSize)
  const balances = responseList(balancesData)
  const quantityByProduct = new Map<string, number>()
  balances.forEach((balance: any) => quantityByProduct.set(
    balance.productId,
    (quantityByProduct.get(balance.productId) ?? 0) + Number(balance.quantityOnHand ?? 0),
  ))
  const saveMaterial = useMutation({
    mutationFn: () => (editingProduct ? api.patch(`/products/${editingProduct.id}`, {
      ...form,
      sku: form.sku.trim() || null,
      brandId: form.brandId || undefined,
      categoryId: form.categoryId || undefined,
      manufacturer: manufacturers.find((item: any) => item.id === form.brandId)?.name ?? form.manufacturer,
      purchasePrice: Number(form.purchasePrice || 0),
      isActive: editingProduct.isActive,
      isStockable: true,
    }) : api.post('/products', {
      ...form,
      sku: form.sku.trim() || null,
      brandId: form.brandId || undefined,
      categoryId: form.categoryId || undefined,
      manufacturer: manufacturers.find((item: any) => item.id === form.brandId)?.name ?? form.manufacturer,
      purchasePrice: Number(form.purchasePrice || 0),
      isActive: true,
      isStockable: true,
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      queryClient.invalidateQueries({ queryKey: ['material-balances'] })
      setShowForm(false)
      setEditingProduct(null)
      setForm({ manufacturer: '', brandId: '', categoryId: '', modelNumber: '', sku: '', name: '', description: '', purchasePrice: '' })
    },
  })
  const deleteMaterial = useMutation({
    mutationFn: (product: any) => api.delete(`/products/${product.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      queryClient.invalidateQueries({ queryKey: ['material-balances'] })
    },
  })
  const toggleStatus = useMutation({
    mutationFn: (product: any) => api.patch(`/products/${product.id}`, { isActive: product.isActive === false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials'] }),
  })

  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="page-header mb-0">
      <h1 className="page-title">Material catalogue</h1>
      <p className="page-description">Product details and ex VAT unit prices used by quotations and stock.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row"><ExportActions title="Materials" columns={[{ label: 'Manufacturer', value: (product: any) => product.manufacturer || product.brand?.name }, { label: 'Model', value: (product: any) => product.modelNumber }, { label: 'Product code', value: (product: any) => product.sku }, { label: 'Material', value: (product: any) => product.name }, { label: 'Description', value: (product: any) => product.description }, { label: 'Quantity', value: (product: any) => quantityByProduct.get(product.id) ?? 0 }, { label: 'Avg. unit price (ex VAT)', value: (product: any) => Number(product.purchasePrice ?? 0).toFixed(2) }, { label: 'Status', value: (product: any) => product.isActive === false ? 'Inactive' : 'Active' }]} rows={visibleProducts} /><button onClick={() => { setEditingProduct(null); setForm({ manufacturer: '', brandId: '', categoryId: '', modelNumber: '', sku: '', name: '', description: '', purchasePrice: '' }); setShowForm(true); void Promise.all([refetchTypes(), refetchManufacturers()]) }} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add material</button></div>
    </div>

    <div className="section-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative w-full max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search make, model, product code or description..." className="w-full rounded-lg border bg-muted/30 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div><select aria-label="Filter materials by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1) }} className="min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><select aria-label="Filter materials by manufacturer" value={manufacturerFilter} onChange={(event) => { setManufacturerFilter(event.target.value); setPage(1) }} className="min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">All manufacturers</option>{manufacturers.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Filter materials by product type" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }} className="min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">All product types</option>{productTypes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    </div>

      <div className="section-card overflow-hidden">
      {isLoading ? <div className="p-10 text-center text-muted-foreground"><RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading materials...</div>
        : isError ? <div className="p-10 text-center text-red-500">Could not load materials. Check the API connection and your product permissions.</div>
        : visibleProducts.length === 0 ? <div className="p-12 text-center"><Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">No materials found</p><p className="mt-1 text-sm text-muted-foreground/60">Add products to use them in quotations and stock.</p></div>
        : <div className="overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <thead><tr><th>Manufacturer / Make</th><th className="whitespace-nowrap">Model</th><th className="whitespace-nowrap">Product Code</th><th>Material Description</th><th className="whitespace-nowrap text-right">Quantity</th><th className="whitespace-nowrap text-right">Avg. unit price (ex VAT)</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{paginatedProducts.rows.map((product: any) => <tr key={product.id}>
              <td className="font-medium">{product.manufacturer || product.brand?.name || '—'}</td>
              <td className="whitespace-nowrap font-mono text-xs">{product.modelNumber || '—'}</td>
              <td className="whitespace-nowrap font-mono text-xs">{product.sku || '—'}</td>
              <td><p className="font-medium">{product.name}</p>{product.description && <p className="max-w-lg truncate text-xs text-muted-foreground">{product.description}</p>}</td>
              <td className="text-right tabular-nums">{quantityByProduct.get(product.id) ?? 0}</td>
              <td className="text-right font-medium tabular-nums">{formatCurrency(Number(product.purchasePrice ?? 0))}</td><td><span className={`badge-status ${product.isActive === false ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700'}`}>{product.isActive === false ? 'Inactive' : 'Active'}</span></td><td><div className="flex items-center"><button type="button" onClick={() => setViewingProduct(product)} aria-label={`View ${product.name} details and price history`} title="View details and price history" className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><Eye className="h-4 w-4" /></button><button type="button" onClick={() => toggleStatus.mutate(product)} aria-label={`${product.isActive === false ? 'Activate' : 'Deactivate'} ${product.name}`} title={product.isActive === false ? 'Activate material' : 'Deactivate material'} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><Power className="h-4 w-4" /></button><button type="button" onClick={() => { const manufacturerName = product.manufacturer || product.brand?.name || ''; const matchingManufacturer = manufacturers.find((item: any) => item.name?.trim().toLowerCase() === manufacturerName.trim().toLowerCase()); setEditingProduct(product); setForm({ manufacturer: manufacturerName, brandId: product.brandId ?? product.brand?.id ?? matchingManufacturer?.id ?? '', categoryId: product.categoryId ?? product.category?.id ?? '', modelNumber: product.modelNumber ?? '', sku: product.sku ?? '', name: product.name ?? '', description: product.description ?? '', purchasePrice: String(product.purchasePrice ?? '') }); setShowForm(true) }} aria-label={`Edit ${product.name}`} title="Edit material" className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => { if (window.confirm(`Delete “${product.name}”? This will remove it from the active catalogue.`)) deleteMaterial.mutate(product) }} aria-label={`Delete ${product.name}`} title="Delete material" className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></td>
            </tr>)}</tbody>
          </table>
        </div>}
      {!isLoading && !isError && visibleProducts.length > 0 && <Pagination page={paginatedProducts.page} pageSize={pageSize} total={visibleProducts.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
    </div>

    {viewingProduct && <ProductDetailsDialog product={viewingProduct} quantityOnHand={quantityByProduct.get(viewingProduct.id) ?? 0} onClose={() => setViewingProduct(null)} />}

    {showForm && createPortal(<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-4 sm:px-6"><div><h2 className="text-lg font-semibold">{editingProduct ? 'Edit material' : 'Add material'}</h2><p className="text-sm text-muted-foreground">Enter the details used in quotations and stock.</p></div><button onClick={() => { setShowForm(false); setEditingProduct(null) }} aria-label="Close"><X className="h-5 w-5" /></button></div>
        <form className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6" onSubmit={(event) => { event.preventDefault(); saveMaterial.mutate() }}>
          <label className="sm:col-span-2"><span className="form-label">Product type</span><select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-sm"><option value="">{isLoadingTypes && !activeProductTypes.length ? 'Loading product types…' : 'Select product type'}</option>{activeProductTypes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{isTypesError && <span role="alert" className="mt-1 block text-xs text-red-600">Could not load product types. <button type="button" onClick={() => { void refetchTypes() }} className="font-medium underline">Try again</button></span>}<Link to="/products/types" className="mt-1 inline-block text-xs text-primary hover:underline">Manage product types</Link></label>
          <label><span className="form-label">Manufacturer / Make</span><select value={form.brandId} onChange={(event) => setForm({ ...form, brandId: event.target.value, manufacturer: '' })} className="min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-sm"><option value="">Select manufacturer</option>{activeManufacturers.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Link to="/products/manufacturers" className="mt-1 inline-block text-xs text-primary hover:underline">Manage manufacturers</Link></label>
          <label><span className="form-label">Model *</span><input required value={form.modelNumber} onChange={(event) => setForm({ ...form, modelNumber: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          <label><span className="form-label">Product code</span><input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          <label><span className="form-label">Material name *</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          <label className="sm:col-span-2"><span className="form-label">Material description *</span><textarea required rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          <label><span className="form-label">Weighted average unit price (£ ex VAT)</span><input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={form.purchasePrice} onChange={(event) => { const value = event.target.value; if (/^\d*\.?\d*$/.test(value)) setForm({ ...form, purchasePrice: value }) }} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          {saveMaterial.isError && <p className="sm:col-span-2 text-sm text-red-500">{(saveMaterial.error as Error).message}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => { setShowForm(false); setEditingProduct(null) }} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saveMaterial.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saveMaterial.isPending ? 'Saving...' : editingProduct ? 'Save changes' : 'Save material'}</button></div>
        </form>
      </div>
    </div>, document.body)}
  </div>
}

export default MaterialsPage

function ProductDetailsDialog({ product, quantityOnHand, onClose }: { product: any; quantityOnHand: number; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details')
  const historyQuery = useQuery({
    queryKey: ['product-price-history', product.id],
    queryFn: async () => {
      const response: any = await api.get(`/products/${product.id}/price-history`)
      return response?.data ?? response ?? []
    },
    enabled: activeTab === 'history',
  })
  const history = historyQuery.data ?? []

  return createPortal(<div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="product-details-title" onClick={(event) => event.stopPropagation()} className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl">
      <header className="flex items-start justify-between border-b px-5 py-4 sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Product details</p><h2 id="product-details-title" className="mt-1 text-lg font-semibold">{product.name}</h2><p className="text-sm text-muted-foreground">{product.manufacturer || product.brand?.name || 'No manufacturer'} · {product.modelNumber || 'No model'}</p></div><button type="button" onClick={onClose} aria-label="Close product details" className="rounded-lg p-2 hover:bg-accent"><X className="h-5 w-5" /></button></header>
      <div role="tablist" aria-label="Product detail tabs" className="flex gap-1 border-b px-5 sm:px-6">
        <button type="button" role="tab" aria-selected={activeTab === 'details'} onClick={() => setActiveTab('details')} className={`border-b-2 px-3 py-3 text-sm font-medium ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Details</button>
        <button type="button" role="tab" aria-selected={activeTab === 'history'} onClick={() => setActiveTab('history')} className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}><Clock3 className="h-4 w-4" />Price history</button>
      </div>
      {activeTab === 'details' ? <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Product code</p><p className="mt-1 font-mono text-sm">{product.sku || 'No code'}</p></div>
        <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Product type</p><p className="mt-1 text-sm">{product.category?.name || '—'}</p></div>
        <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Weighted average unit price (ex VAT)</p><p className="mt-1 font-semibold">{formatCurrency(Number(product.purchasePrice ?? 0))}</p></div>
        <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Quantity on hand</p><p className="mt-1 font-semibold">{Number(quantityOnHand).toLocaleString()}</p></div>
        <div className="rounded-xl border p-4 sm:col-span-2"><p className="text-xs text-muted-foreground">Description</p><p className="mt-1 whitespace-pre-wrap text-sm">{product.description || '—'}</p></div>
      </div> : <div className="p-5 sm:p-6">
        <p className="mb-4 text-sm text-muted-foreground">Each price change includes the stock quantity on hand at the time it was recorded.</p>
        {historyQuery.isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading price history…</div>
          : historyQuery.isError ? <div role="alert" className="p-8 text-center text-sm text-red-600">Could not load product price history.</div>
          : history.length === 0 ? <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No price changes recorded yet.</div>
          : <div className="overflow-x-auto rounded-xl border"><table className="data-table min-w-[640px]"><thead><tr><th>Date</th><th>Previous price</th><th>New price</th><th className="text-right">Quantity on hand</th><th>Changed from</th></tr></thead><tbody>{history.map((entry: any) => <tr key={entry.id}><td className="text-sm">{new Date(entry.createdAt).toLocaleString()}</td><td className="text-sm">{entry.previousPrice == null ? '—' : formatCurrency(Number(entry.previousPrice))}</td><td className="font-medium">{formatCurrency(Number(entry.newPrice))}</td><td className="text-right tabular-nums">{Number(entry.quantityOnHand ?? 0).toLocaleString()}</td><td className="text-sm">{entry.source === 'stock_receipt' ? 'Stock receipt' : entry.source === 'product_created' ? 'Product created' : entry.source === 'migration_snapshot' ? 'Starting snapshot' : 'Product details'}</td></tr>)}</tbody></table></div>}
      </div>}
    </section>
  </div>, document.body)
}
