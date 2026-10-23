import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, FileText, Package, Tags, Factory, Boxes, LayoutDashboard, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { resolveAssetUrl } from '@/lib/assets'

const sections = [
  { title: 'Product types', icon: Tags, links: [{ title: 'All product types', to: '/products/types' }] },
  { title: 'Manufacturers', icon: Factory, links: [{ title: 'All manufacturers', to: '/products/manufacturers' }] },
  { title: 'Materials', icon: Boxes, links: [{ title: 'Material catalogue', to: '/products' }] },
  { title: 'Quotations', icon: FileText, links: [{ title: 'All quotations', to: '/quotations' }] },
  { title: 'Invoices', icon: Receipt, links: [{ title: 'All invoices', to: '/invoices' }] },
  { title: 'Stock', icon: Package, links: [{ title: 'Stock levels', to: '/stock' }] },
]

const routeMatches = (pathname: string, route: string) => route === '/products'
  ? pathname === route
  : pathname === route || pathname.startsWith(`${route}/`)

export function Sidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const location = useLocation()
  const companyQuery = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const result: any = await api.get('/settings/company')
      return result?.data ?? result
    },
  })
  const company = companyQuery.data as any
  const [expanded, setExpanded] = useState<string[]>(() =>
    sections.filter((section) => section.links.some((link) => routeMatches(location.pathname, link.to)))
      .map((section) => section.title),
  )
  const collapsed = !open

  useEffect(() => {
    const activeSection = sections.find((section) => section.links.some((link) => routeMatches(location.pathname, link.to)))
    setExpanded(activeSection ? [activeSection.title] : [])
  }, [location.pathname])

  return (
    <aside className={cn(
      'flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300',
      open ? 'w-64' : 'w-16',
      'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:shadow-2xl',
      !open && 'max-md:-translate-x-full max-md:pointer-events-none',
    )}>
      <div className={cn('flex min-h-[74px] items-center gap-3 border-b border-sidebar-border px-4 py-3', collapsed && 'justify-center px-0')}>
        <img src={company?.logoUrl ? resolveAssetUrl(company.logoUrl) : '/toggar-mark.svg'} alt={collapsed ? (company?.name || 'Toggar') : ''} className="h-10 w-10 shrink-0 rounded-xl bg-white p-1 object-contain" onError={(event) => { event.currentTarget.src = '/toggar-mark.svg' }} />
        {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{company?.name || 'Toggar'}</p><p className="truncate text-xs text-sidebar-foreground/60">Heat & Aircon</p></div>}
        {!collapsed && <button type="button" onClick={onToggle} className="hidden rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent max-md:block" aria-label="Close navigation">×</button>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        <NavLink to="/dashboard" end title={collapsed ? 'Dashboard' : undefined} onClick={() => { if (window.matchMedia('(max-width: 767px)').matches) onToggle() }} className={({ isActive }) => cn('sidebar-item', isActive && 'active')}>
          <LayoutDashboard className="h-4 w-4 shrink-0" />{!collapsed && <span>Dashboard</span>}
        </NavLink>
        {sections.map((section) => {
          const Icon = section.icon
          const isOpen = expanded.includes(section.title)
          const active = section.links.some((link) => routeMatches(location.pathname, link.to))
          return <div key={section.title}>
            <button
              type="button"
              title={collapsed ? section.title : undefined}
              onClick={() => setExpanded(isOpen ? [] : [section.title])}
              className={cn('sidebar-item w-full', active && 'text-white')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <><span className="flex-1 text-left">{section.title}</span>{isOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : <ChevronRight className="h-3.5 w-3.5 opacity-60" />}</>}
            </button>
            {isOpen && !collapsed && <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
              {section.links.map((link) => <NavLink key={link.to} to={link.to} end className={({ isActive }) => cn('sidebar-item', isActive && 'active')} onClick={() => { if (window.matchMedia('(max-width: 767px)').matches) onToggle() }}>
                <span>{link.title}</span>
              </NavLink>)}
            </div>}
          </div>
        })}
      </nav>

      {!collapsed && <div className="border-t border-sidebar-border px-3 py-3"><p className="text-center text-xs text-sidebar-foreground/40">Toggar ERP</p></div>}
    </aside>
  )
}
