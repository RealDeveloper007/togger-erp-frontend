import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit, Trash2, Package, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, getStatusColor, formatStatus } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function ProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['products', { page, search }],
    queryFn: () => api.get(`/products?page=${page}&limit=20&search=${search}`) as any,
  })

  const products = (data as any)?.data?.data || []
  const total = (data as any)?.data?.total || 0
  const totalPages = Math.ceil(total / 20)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Product Catalogue</h1>
          <p className="page-description">{total} products in your catalogue</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="section-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, SKU, or model number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-lg border bg-muted/30 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="section-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">No products found</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Add your first product to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU / Model</th>
                  <th>Product Name</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Purchase Price</th>
                  <th>Sale Price</th>
                  <th>VAT</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product: any) => (
                  <tr key={product.id}>
                    <td>
                      <div className="font-mono text-xs text-muted-foreground">{product.sku || '—'}</div>
                      <div className="text-xs text-muted-foreground/60">{product.modelNumber || ''}</div>
                    </td>
                    <td>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{product.description}</p>
                      )}
                    </td>
                    <td className="text-sm">{product.brand?.name || '—'}</td>
                    <td className="text-sm">{product.category?.name || '—'}</td>
                    <td className="text-sm font-medium">{formatCurrency(product.purchasePrice || 0)}</td>
                    <td className="text-sm font-medium">{formatCurrency(product.salePrice || 0)}</td>
                    <td className="text-sm">{product.vatRate?.rate ?? 20}%</td>
                    <td>
                      <span className={cn('badge-status', getStatusColor(product.isActive ? 'active' : 'inactive'))}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditing(product); setShowForm(true) }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete this product?')) deleteMutation.mutate(product.id) }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages} • {total} total</p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-accent transition-colors"
              >Previous</button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-accent transition-colors"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <ProductFormModal
          product={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['products'] }); setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function ProductFormModal({ product, onClose, onSaved }: { product: any; onClose: () => void; onSaved: () => void }) {
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => api.get('/products/brands/all') as any })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/products/categories/all') as any })
  const { data: vatRates } = useQuery({ queryKey: ['vat-rates'], queryFn: () => api.get('/settings/vat-rates') as any })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers?limit=100') as any })

  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    modelNumber: product?.modelNumber || '',
    description: product?.description || '',
    brandId: product?.brandId || '',
    categoryId: product?.categoryId || '',
    supplierId: product?.supplierId || '',
    vatRateId: product?.vatRateId || '',
    purchasePrice: product?.purchasePrice || '',
    salePrice: product?.salePrice || '',
    reorderLevel: product?.reorderLevel || 5,
    isActive: product?.isActive ?? true,
    isStockable: product?.isStockable ?? true,
  })

  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (product) {
        await api.patch(`/products/${product.id}`, form)
      } else {
        await api.post('/products', form)
      }
      onSaved()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border bg-card shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-lg">{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">Product Name *</label>
            <input className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="form-label">SKU</label>
            <input className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.sku} onChange={e => set('sku', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Model Number</label>
            <input className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.modelNumber} onChange={e => set('modelNumber', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Brand</label>
            <select className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.brandId} onChange={e => set('brandId', e.target.value)}>
              <option value="">Select brand...</option>
              {((brands as any)?.data || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Category</label>
            <select className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
              <option value="">Select category...</option>
              {((categories as any)?.data || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Purchase Price (£)</label>
            <input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.purchasePrice} onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) set('purchasePrice', e.target.value) }} />
          </div>
          <div>
            <label className="form-label">Sale Price (£)</label>
            <input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.salePrice} onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) set('salePrice', e.target.value) }} />
          </div>
          <div>
            <label className="form-label">VAT Rate</label>
            <select className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.vatRateId} onChange={e => set('vatRateId', e.target.value)}>
              <option value="">Select VAT rate...</option>
              {((vatRates as any)?.data || []).map((v: any) => <option key={v.id} value={v.id}>{v.name} ({v.rate}%)</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Reorder Level</label>
            <input type="number" className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.reorderLevel} onChange={e => set('reorderLevel', parseInt(e.target.value))} />
          </div>
          <div className="col-span-2">
            <label className="form-label">Description</label>
            <textarea rows={3} className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} className="rounded" />
            <label htmlFor="isActive" className="text-sm font-medium">Active</label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isStockable" checked={form.isStockable} onChange={e => set('isStockable', e.target.checked)} className="rounded" />
            <label htmlFor="isStockable" className="text-sm font-medium">Track Stock</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : product ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
