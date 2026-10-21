import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Component, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { QuotationsPage, NewQuotationPage } from '@/pages/quotations/QuotationsPage'
import { StockPage } from '@/pages/inventory/StockPage'
import { ProductSetupPage } from '@/pages/products/ProductSetupPage'
import { BrandLoader } from '@/components/common/BrandLoader'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import MaterialsPage from '@/pages/products/MaterialsPage'
import { CompanyProfilePage } from '@/pages/settings/CompanyProfilePage'
import { InvoicesPage } from '@/pages/invoices/InvoicesPage'

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; retryKey: number }> {
  state: { hasError: boolean; retryKey: number } = { hasError: false, retryKey: 0 }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('A page failed to load:', error)
  }

  render() {
    if (this.state.hasError) {
      return <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center"><h1 className="text-lg font-semibold">This page could not be loaded</h1><p className="text-sm text-muted-foreground">Try loading this page again.</p><div className="flex gap-2"><button type="button" onClick={() => this.setState((state) => ({ hasError: false, retryKey: state.retryKey + 1 }))} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">Try again</button><button type="button" onClick={() => window.location.reload()} className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Reload page</button></div></div>
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>
  }
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

export default function App() {
  const loadProfile = useAuthStore((state) => state.loadProfile)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [checkingSession, setCheckingSession] = useState(isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) {
      setCheckingSession(false)
      return
    }
    let active = true
    void loadProfile().finally(() => { if (active) setCheckingSession(false) })
    return () => { active = false }
  }, [])

  if (checkingSession) return <BrandLoader label="Checking your session…" />

  return <BrowserRouter><AppRoutes /></BrowserRouter>
}

function AppRoutes() {
  const location = useLocation()

  return <RouteErrorBoundary key={location.key}><Suspense fallback={<BrandLoader />}><Routes>
    <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
    <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/quotations" element={<QuotationsPage />} />
      <Route path="/quotations/new" element={<NewQuotationPage />} />
      <Route path="/invoices" element={<InvoicesPage />} />
      <Route path="/products" element={<MaterialsPage />} />
      <Route path="/products/types" element={<ProductSetupPage kind="type" />} />
      <Route path="/products/manufacturers" element={<ProductSetupPage kind="manufacturer" />} />
      <Route path="/stock" element={<StockPage />} />
      <Route path="/company-profile" element={<CompanyProfilePage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense></RouteErrorBoundary>
}

function NotFoundPage() {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
    <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
    <h1 className="text-2xl font-bold">Page not found</h1>
    <p className="text-sm text-muted-foreground">This address does not match a page in Toggar ERP.</p>
    <Link to="/dashboard" className="mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">Go to dashboard</Link>
  </div>
}
