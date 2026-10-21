import { Menu, Bell, Search, LogOut, ChevronDown, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import { resolveAssetUrl } from '@/lib/assets'

interface TopbarProps {
  onMenuToggle: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : 'User'
  const initials = user ? getInitials(user.firstName, user.lastName) : 'TH'
  const roleName = user?.roles?.[0]?.name || 'Staff'

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 shadow-sm">
      {/* Menu toggle */}
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search (decorative) */}
      <div className="hidden md:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-lg border bg-muted/50 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
        <Bell className="h-5 w-5" />
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
      </button>

      {/* User dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-accent transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-white shadow-sm">
            {user?.avatarUrl ? <img src={resolveAssetUrl(user.avatarUrl)} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground leading-tight">{roleName}</p>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', dropdownOpen && 'rotate-180')} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border bg-popover shadow-lg z-50 animate-scale-in overflow-hidden">
            <div className="px-3 py-2.5 border-b">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <div className="py-1">
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => { setDropdownOpen(false); navigate('/company-profile') }}
              >
                <Building2 className="h-4 w-4" />
                Company profile
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
