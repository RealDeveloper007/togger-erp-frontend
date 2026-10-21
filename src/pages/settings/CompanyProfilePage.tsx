import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Building2, KeyRound, Save, UserRound } from 'lucide-react'
import api from '@/lib/api'
import { resolveAssetUrl } from '@/lib/assets'
import { useAuthStore, type UserProfile } from '@/stores/auth.store'

type CompanyProfile = {
  logoUrl?: string | null
  name: string
  email: string
  phone: string
  website: string
  addressLine1: string
  addressLine2: string
  city: string
  postcode: string
  country: string
  vatNumber: string
  companyRegistrationNumber: string
}

const emptyCompany: CompanyProfile = {
  name: '', email: '', phone: '', website: '', addressLine1: '', addressLine2: '', city: '', postcode: '', country: '', vatNumber: '', companyRegistrationNumber: '',
}

export function CompanyProfilePage() {
  const [toast, setToast] = useState<{ id: number; type: 'success' | 'error'; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'company' | 'profile'>('company')
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [company, setCompany] = useState<CompanyProfile>(emptyCompany)
  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '' })
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null)
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null)
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => setToast({ id: Date.now(), type, message })

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextTab = event.key === 'Home' || (event.key === 'ArrowLeft' && activeTab === 'profile')
      ? 'company'
      : event.key === 'End' || (event.key === 'ArrowRight' && activeTab === 'company')
        ? 'profile'
        : activeTab
    setActiveTab(nextTab)
    document.getElementById(nextTab === 'company' ? 'company-profile-tab' : 'profile-tab')?.focus()
  }

  const companyQuery = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const result: any = await api.get('/settings/company')
      return result?.data ?? result
    },
  })

  useEffect(() => {
    if (companyQuery.data) setCompany({ ...emptyCompany, ...companyQuery.data })
  }, [companyQuery.data])
  useEffect(() => {
    if (user) setProfile({ firstName: user.firstName ?? '', lastName: user.lastName ?? '', phone: (user as any).phone ?? '' })
  }, [user])
  useEffect(() => () => {
    if (companyLogoPreview) URL.revokeObjectURL(companyLogoPreview)
  }, [companyLogoPreview])
  useEffect(() => () => {
    if (profileImagePreview) URL.revokeObjectURL(profileImagePreview)
  }, [profileImagePreview])

  const saveCompany = useMutation({
    mutationFn: async () => {
      const result: any = await api.patch('/settings/company', company)
      return result?.data ?? result
    },
    onSuccess: (saved) => {
      setCompany({ ...emptyCompany, ...saved })
      queryClient.invalidateQueries({ queryKey: ['company-settings'] })
      showToast('success', 'Company details saved.')
    },
    onError: (error) => showToast('error', (error as Error).message || 'Could not save company details.'),
  })

  const uploadCompanyLogo = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('logo', file)
      const result: any = await api.post('/settings/company/logo', formData)
      return result?.data ?? result
    },
    onSuccess: (saved) => {
      setCompany((current) => ({ ...current, ...saved }))
      setCompanyLogoPreview(null)
      queryClient.setQueryData(['company-settings'], saved)
      showToast('success', 'Company logo uploaded.')
    },
    onError: (error) => showToast('error', (error as Error).message || 'Could not upload the company logo.'),
  })

  const saveProfile = useMutation({
    mutationFn: async () => {
      const result: any = await api.patch('/users/me/profile', profile)
      return result?.data ?? result
    },
    onSuccess: (saved: UserProfile) => {
      useAuthStore.setState((state) => ({ user: state.user ? { ...state.user, ...saved } : saved }))
      setProfileImagePreview(null)
      setProfileImageFile(null)
      showToast('success', 'Profile details saved.')
    },
    onError: (error) => showToast('error', (error as Error).message || 'Could not save profile details.'),
  })

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('avatar', file)
      const result: any = await api.post('/users/me/avatar', formData)
      return result?.data ?? result
    },
    onSuccess: (saved: UserProfile) => {
      useAuthStore.setState((state) => ({ user: state.user ? { ...state.user, ...saved } : saved }))
      setProfileImagePreview(null)
      setProfileImageFile(null)
      showToast('success', 'Profile image uploaded.')
    },
    onError: (error) => showToast('error', (error as Error).message || 'Could not upload the profile image.'),
  })

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: password.currentPassword, newPassword: password.newPassword }),
    onSuccess: () => {
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
      showToast('success', 'Password changed successfully.')
    },
    onError: (error) => showToast('error', (error as Error).message || 'Could not change the password.'),
  })

  const handlePasswordSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (password.newPassword.length < 8) {
      showToast('error', 'Use at least 8 characters for the new password.')
      return
    }
    if (password.newPassword !== password.confirmPassword) {
      showToast('error', 'The new password and confirmation do not match.')
      return
    }
    changePassword.mutate()
  }

  return <div className="mx-auto max-w-5xl animate-fade-in space-y-6">
    {toast && <div className={`fixed right-4 top-4 z-[100] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${toast.type === 'success' ? 'border-emerald-200 bg-white text-emerald-800' : 'border-red-200 bg-white text-red-700'}`} role={toast.type === 'success' ? 'status' : 'alert'} key={toast.id}>
      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <span className="flex-1">{toast.message}</span>
      <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="-mr-1 -mt-1 rounded p-1 text-muted-foreground hover:bg-muted">×</button>
    </div>}
    <div className="page-header mb-0"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Account settings</p><h1 className="page-title">Company profile</h1><p className="page-description">Manage the company logo, business details, and your profile.</p></div>

    <div role="tablist" aria-label="Profile sections" onKeyDown={handleTabKeyDown} className="flex w-full gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1 sm:w-fit">
      <button id="company-profile-tab" type="button" role="tab" tabIndex={activeTab === 'company' ? 0 : -1} aria-selected={activeTab === 'company'} aria-controls="company-profile-panel" onClick={() => setActiveTab('company')} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors sm:flex-none ${activeTab === 'company' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Building2 className="h-4 w-4" />Company logo</button>
      <button id="profile-tab" type="button" role="tab" tabIndex={activeTab === 'profile' ? 0 : -1} aria-selected={activeTab === 'profile'} aria-controls="profile-panel" onClick={() => setActiveTab('profile')} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors sm:flex-none ${activeTab === 'profile' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><UserRound className="h-4 w-4" />Profile</button>
    </div>

    {activeTab === 'company' && <div id="company-profile-panel" role="tabpanel" aria-labelledby="company-profile-tab" className="space-y-6">
    <section className="section-card overflow-hidden">
      <div className="flex items-center gap-3 border-b p-5 sm:p-6"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Building2 className="h-5 w-5" /></div><div><h2 className="font-semibold">Company logo</h2><p className="text-sm text-muted-foreground">Upload the logo used to identify your company.</p></div></div>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/30 p-3">{companyLogoPreview || company.logoUrl ? <img src={companyLogoPreview || resolveAssetUrl(company.logoUrl)} alt="Company logo preview" className="max-h-full max-w-full object-contain" /> : <span className="text-sm text-muted-foreground">No logo uploaded</span>}</div>
        <div className="min-w-0"><label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent"><Camera className="h-4 w-4" />Choose company logo<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setCompanyLogoPreview(URL.createObjectURL(file)); uploadCompanyLogo.reset(); uploadCompanyLogo.mutate(file) } event.currentTarget.value = '' }} /></label><p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP. Maximum 5 MB.</p>{uploadCompanyLogo.isPending && <p role="status" className="mt-1 text-sm text-muted-foreground">Uploading company logo…</p>}</div>
      </div>
    </section>
    <section className="section-card overflow-hidden">
      <div className="flex items-center gap-3 border-b p-5 sm:p-6"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Building2 className="h-5 w-5" /></div><div><h2 className="font-semibold">Company details</h2><p className="text-sm text-muted-foreground">These details identify your business on quotations and documents.</p></div></div>
      {companyQuery.isError ? <p className="p-6 text-sm text-red-600">Could not load company details: {(companyQuery.error as Error).message}</p> : <form className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6" onSubmit={(event) => { event.preventDefault(); saveCompany.mutate() }}>
        <label><span className="form-label">Company name *</span><input required value={company.name} onChange={(event) => setCompany({ ...company, name: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label><span className="form-label">Company email</span><input type="email" value={company.email} onChange={(event) => setCompany({ ...company, email: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label><span className="form-label">Phone</span><input value={company.phone} onChange={(event) => setCompany({ ...company, phone: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label><span className="form-label">Website</span><input type="url" value={company.website} onChange={(event) => setCompany({ ...company, website: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" placeholder="https://example.com" /></label>
        <label><span className="form-label">Address line 1</span><input value={company.addressLine1} onChange={(event) => setCompany({ ...company, addressLine1: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label><span className="form-label">Address line 2</span><input value={company.addressLine2} onChange={(event) => setCompany({ ...company, addressLine2: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label><span className="form-label">City</span><input value={company.city} onChange={(event) => setCompany({ ...company, city: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label><span className="form-label">Postcode</span><input value={company.postcode} onChange={(event) => setCompany({ ...company, postcode: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label><span className="form-label">Country</span><input value={company.country} onChange={(event) => setCompany({ ...company, country: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label><span className="form-label">VAT number</span><input value={company.vatNumber} onChange={(event) => setCompany({ ...company, vatNumber: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <label><span className="form-label">Company registration number</span><input value={company.companyRegistrationNumber} onChange={(event) => setCompany({ ...company, companyRegistrationNumber: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end"><button disabled={saveCompany.isPending || companyQuery.isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saveCompany.isPending ? 'Saving…' : 'Save company details'}</button></div>
      </form>}
    </section>
    </div>}

    {activeTab === 'profile' && <div id="profile-panel" role="tabpanel" aria-labelledby="profile-tab" className="space-y-6">
    <section className="section-card overflow-hidden">
      <div className="flex items-center gap-3 border-b p-5 sm:p-6"><div className="rounded-xl bg-blue-100 p-2.5 text-blue-700"><UserRound className="h-5 w-5" /></div><div><h2 className="font-semibold">Profile</h2><p className="text-sm text-muted-foreground">Personal account details, photo, and password.</p></div></div>
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-semibold text-white">{profileImagePreview || user?.avatarUrl ? <img src={profileImagePreview || resolveAssetUrl(user?.avatarUrl)} alt="Profile preview" className="h-full w-full object-cover" /> : `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`}</div><div><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"><Camera className="h-4 w-4" />Choose profile image<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setProfileImageFile(file); setProfileImagePreview(URL.createObjectURL(file)); uploadAvatar.reset(); uploadAvatar.mutate(file) } event.currentTarget.value = '' }} /></label><p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP. Maximum 5 MB.</p>{uploadAvatar.isPending && <p role="status" className="mt-1 text-sm text-muted-foreground">Uploading profile image…</p>}{uploadAvatar.isError && profileImageFile && <button type="button" onClick={() => uploadAvatar.mutate(profileImageFile)} className="mt-1 text-sm font-medium text-primary hover:underline">Retry upload</button>}</div></div>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); saveProfile.mutate() }}>
            <label><span className="form-label">First name</span><input required value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
            <label><span className="form-label">Last name</span><input required value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
            <label><span className="form-label">Email address</span><input readOnly value={user?.email ?? ''} className="w-full cursor-default rounded-lg border bg-muted px-3 py-2.5 text-sm text-muted-foreground" /></label>
            <label><span className="form-label">Phone</span><input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
            <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center"><button disabled={saveProfile.isPending} className="ml-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saveProfile.isPending ? 'Saving…' : 'Save profile'}</button></div>
          </form>
        </div>

        <form className="h-fit space-y-4 rounded-xl border bg-muted/20 p-4 sm:p-5" onSubmit={handlePasswordSubmit}>
          <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /><h3 className="font-semibold">Change password</h3></div>
          <label className="block"><span className="form-label">Current password</span><input required type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          <label className="block"><span className="form-label">New password</span><input required minLength={8} type="password" autoComplete="new-password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          <label className="block"><span className="form-label">Confirm new password</span><input required minLength={8} type="password" autoComplete="new-password" value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></label>
          <button disabled={changePassword.isPending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-accent disabled:opacity-50">{changePassword.isPending ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    </section>
    </div>}
  </div>
}
