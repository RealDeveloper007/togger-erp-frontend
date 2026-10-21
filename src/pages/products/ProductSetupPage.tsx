import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Factory, Plus, Search, Tags, Pencil, Trash2, X, Power } from 'lucide-react'
import api from '@/lib/api'
import { ExportActions } from '@/components/common/ExportActions'
import { Pagination, useClientPagination } from '@/components/common/Pagination'

type Kind = 'type' | 'manufacturer'
type SetupItem = { id: string; name: string; description?: string | null; isActive?: boolean }

const config = {
  type: { title: 'Product types', singular: 'product type', endpoint: '/products/categories', icon: Tags, description: 'Organise materials into useful groups for stock and quotations.' },
  manufacturer: { title: 'Manufacturers', singular: 'manufacturer', endpoint: '/products/brands', icon: Factory, description: 'Maintain the makes that can be selected when creating a material.' },
} as const

function unwrap<T>(response: any): T {
  return (response?.data?.data ?? response?.data ?? response) as T
}

export function ProductSetupPage({ kind }: { kind: Kind }) {
  const settings = config[kind]
  const Icon = settings.icon
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [editing, setEditing] = useState<SetupItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const queryKey = [kind === 'type' ? 'categories' : 'brands']
  const listUrl = kind === 'type' ? `${settings.endpoint}/all` : `${settings.endpoint}/all`
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => unwrap<SetupItem[]>(await api.get(listUrl)),
  })
  const rows = Array.isArray(data) ? data : []
  const items = rows.filter((item) => {
    const active = item.isActive !== false
    return `${item.name} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
      && (statusFilter === 'all' || (statusFilter === 'active' ? active : !active))
  })
  const paginatedItems = useClientPagination(items, page, pageSize)
  const save = useMutation({
    mutationFn: async () => unwrap<SetupItem>(editing
      ? await api.patch(`${settings.endpoint}/${editing.id}`, form)
      : await api.post(settings.endpoint, form)),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey }); setShowForm(false); setEditing(null); setForm({ name: '', description: '' }) },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${settings.endpoint}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })
  const toggleStatus = useMutation({
    mutationFn: (item: SetupItem) => api.patch(`${settings.endpoint}/${item.id}`, { isActive: item.isActive === false }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '' }); save.reset(); setShowForm(true) }
  const openEdit = (item: SetupItem) => { setEditing(item); setForm({ name: item.name, description: item.description ?? '' }); save.reset(); setShowForm(true) }

  return <div className="animate-fade-in space-y-5 sm:space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="page-header mb-0"><div className="mb-1 flex items-center gap-2 text-primary"><Icon className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Product setup</span></div><h1 className="page-title">{settings.title}</h1><p className="page-description">{settings.description}</p></div>
      <div className="flex flex-col gap-2 sm:flex-row"><ExportActions title={settings.title} columns={[{ label: 'Name', value: (item: SetupItem) => item.name }, { label: 'Description', value: (item: SetupItem) => item.description }, { label: 'Status', value: (item: SetupItem) => item.isActive === false ? 'Inactive' : 'Active' }]} rows={items} /><button onClick={openCreate} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm sm:w-auto"><Plus className="h-4 w-4" />Add {settings.singular}</button></div>
    </div>

    <div className="section-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={`Search ${settings.title.toLowerCase()}...`} className="min-h-11 w-full rounded-lg border bg-muted/30 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div><select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1) }} className="min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      <span className="text-sm text-muted-foreground">{items.length} {items.length === 1 ? settings.singular : `${settings.singular}s`}</span>
    </div>

    <div className="section-card overflow-hidden">
      {isLoading ? <div className="p-10 text-center text-muted-foreground">Loading {settings.title.toLowerCase()}...</div>
        : isError ? <div className="p-10 text-center text-sm text-red-500">Could not load {settings.title.toLowerCase()}. Check the API connection and product permissions.</div>
        : items.length === 0 ? <div className="p-10 text-center"><Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="font-medium">No {settings.title.toLowerCase()} found</p><p className="mt-1 text-sm text-muted-foreground">Add one here, then select it while adding a material.</p></div>
        : <><div className="divide-y">{paginatedItems.rows.map((item) => <div key={item.id} className="flex min-w-0 items-center gap-3 p-4 sm:px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description || 'No description'}</p></div>
          <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${item.isActive === false ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700'}`}>{item.isActive === false ? 'Inactive' : 'Active'}</span><div className="flex shrink-0 items-center gap-1"><button type="button" disabled={toggleStatus.isPending} onClick={() => toggleStatus.mutate(item)} title={item.isActive === false ? 'Activate' : 'Deactivate'} aria-label={`${item.isActive === false ? 'Activate' : 'Deactivate'} ${item.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"><Power className="h-4 w-4" /></button><button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => { if (window.confirm(`Delete ${item.name}?`)) remove.mutate(item.id) }} aria-label={`Delete ${item.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
        </div>)}</div><Pagination page={paginatedItems.page} pageSize={pageSize} total={items.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />{remove.isError && <p className="px-5 pb-4 text-sm text-red-600">{(remove.error as any)?.response?.data?.message || (remove.error as Error).message || `Could not delete ${settings.singular}.`}</p>}</>}
    </div>

    {showForm && createPortal(<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false) }}>
      <div role="dialog" aria-modal="true" aria-labelledby="setup-form-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border bg-card shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-4 py-4 sm:px-6"><div><h2 id="setup-form-title" className="text-lg font-semibold">{editing ? 'Edit' : 'Add'} {settings.singular}</h2><p className="text-sm text-muted-foreground">This will be available when you add a material.</p></div><button type="button" onClick={() => setShowForm(false)} aria-label="Close" className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <form className="space-y-4 p-4 sm:p-6" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
          <label className="block"><span className="form-label">Name *</span><input autoFocus required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-sm" placeholder={kind === 'type' ? 'e.g. Air conditioning unit' : 'e.g. Daikin'} /></label>
          <label className="block"><span className="form-label">Description</span><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" placeholder="Optional notes" /></label>
          {save.isError && <p className="text-sm text-red-500">{(save.error as Error).message || `Could not save ${settings.singular}.`}</p>}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowForm(false)} className="min-h-11 rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={save.isPending} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? 'Saving...' : editing ? `Save ${settings.singular}` : `Add ${settings.singular}`}</button></div>
        </form>
      </div>
    </div>, document.body)}
  </div>
}
