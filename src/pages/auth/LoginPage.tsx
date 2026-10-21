import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Flame, Eye, EyeOff, Loader2, Thermometer, Wind, Zap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { resolveAssetUrl } from '@/lib/assets'

interface LoginForm {
  email: string
  password: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const companyQuery = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const result: any = await api.get('/settings/company')
      return result?.data ?? result
    },
    retry: 1,
  })
  const company = companyQuery.data as any

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setError('')
    try {
      await login(data.email, data.password)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.')
    }
  }

  return (
    <div className="relative min-h-screen flex overflow-hidden bg-[hsl(222,47%,8%)] animate-fade-in">
      {/* Left panel — hero */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse motion-reduce:animate-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 animate-pulse motion-reduce:animate-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-3 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white p-1.5 shadow-xl transition-transform duration-300 hover:scale-105">
            {company?.logoUrl ? <img src={resolveAssetUrl(company.logoUrl)} alt={`${company.name || 'Company'} logo`} className="h-full w-full object-contain" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/toggar-mark.svg' }} /> : <img src="/toggar-mark.svg" alt="Toggar company logo" className="h-full w-full object-contain" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{company?.name || 'Toggar Heat & Aircon'}</h1>
            <p className="text-sm text-white/50">Business Management System</p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="relative space-y-6 animate-fade-in motion-reduce:animate-none">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Complete HVAC<br />
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Business Control
            </span>
          </h2>
          <p className="text-white/60 text-lg leading-relaxed">
            Manage your entire heating, ventilation, and air conditioning business from a single platform.
          </p>
          <div className="space-y-3">
            {[
              { icon: Thermometer, text: 'Full installation job management with engineer assignment' },
              { icon: Wind, text: 'Smart quotation builder with PDF generation' },
              { icon: Zap, text: 'Real-time stock inventory with low-stock alerts' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 transition-transform duration-300 hover:translate-x-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 transition-colors hover:bg-orange-500/30">
                  <Icon className="h-4 w-4 text-orange-400" />
                </div>
                <p className="text-sm text-white/70 leading-snug pt-1">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom badge */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-white/70">System Online</span>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden animate-fade-in">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white p-1.5 shadow-lg">
              {company?.logoUrl ? <img src={resolveAssetUrl(company.logoUrl)} alt={`${company.name || 'Company'} logo`} className="h-full w-full object-contain" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/toggar-mark.svg' }} /> : <img src="/toggar-mark.svg" alt="Toggar company logo" className="h-full w-full object-contain" />}
            </div>
            <div>
              <p className="font-bold text-white text-sm">{company?.name || 'Toggar Heat & Aircon'}</p>
              <p className="text-xs text-white/50">ERP System</p>
            </div>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-shadow duration-500 hover:shadow-orange-950/30 animate-scale-in motion-reduce:animate-none">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-white/50 mt-1">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Error alert */}
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-white/70 mb-1.5 block">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@toggarheatandaircon.com"
                  className={cn(
                    'w-full rounded-xl border bg-white/5 px-4 py-3 text-white placeholder:text-white/25',
                    'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50',
                    'transition-all duration-200',
                    errors.email ? 'border-red-500/50' : 'border-white/10',
                  )}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
                  })}
                />
                {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-medium text-white/70 mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={cn(
                      'w-full rounded-xl border bg-white/5 px-4 py-3 pr-11 text-white placeholder:text-white/25',
                      'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50',
                      'transition-all duration-200',
                      errors.password ? 'border-red-500/50' : 'border-white/10',
                    )}
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold',
                  'bg-gradient-to-r from-orange-500 to-red-500 text-white',
                  'hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/25',
                  'transition-all duration-200 hover:-translate-y-0.5',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/30">
              Toggar Heat & Aircon ERP &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
