import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  status: string
  avatarUrl?: string
  roles: { id: string; name: string; permissions: { permissionKey: string }[] }[]
}

interface AuthState {
  user: UserProfile | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  permissions: Set<string>
  isSuperAdmin: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loadProfile: () => Promise<void>
  clearSession: () => void
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (...permissions: string[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      permissions: new Set(),
      isSuperAdmin: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const response = await api.post('/auth/login', { email, password }) as any
          const { accessToken, refreshToken, user } = response.data

          localStorage.setItem('access_token', accessToken)
          localStorage.setItem('refresh_token', refreshToken)

          const permSet = new Set<string>()
          const isSuperAdmin = user.roles?.some((r: any) => r.name === 'Super Admin') || false
          user.roles?.forEach((role: any) => {
            role.permissions?.forEach((p: any) => permSet.add(p.permissionKey))
          })

          set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
            permissions: permSet,
            isSuperAdmin,
          })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: async () => {
        try {
          const refreshToken = localStorage.getItem('refresh_token')
          if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {})
        } finally {
          get().clearSession()
        }
      },

      clearSession: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false, permissions: new Set(), isSuperAdmin: false })
      },

      loadProfile: async () => {
        try {
          const response = await api.get('/auth/me') as any
          const user = response.data
          const permSet = new Set<string>()
          const isSuperAdmin = user.roles?.some((r: any) => r.name === 'Super Admin') || false
          user.roles?.forEach((role: any) => {
            role.permissions?.forEach((p: any) => permSet.add(p.permissionKey))
          })
          set({ user, isAuthenticated: true, permissions: permSet, isSuperAdmin })
        } catch {
          get().clearSession()
        }
      },

      hasPermission: (permission: string) => {
        const state = get()
        if (state.isSuperAdmin) return true
        return state.permissions.has(permission)
      },

      hasAnyPermission: (...permissions: string[]) => {
        const state = get()
        if (state.isSuperAdmin) return true
        return permissions.some((p) => state.permissions.has(p))
      },
    }),
    {
      name: 'toggar-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        isSuperAdmin: state.isSuperAdmin,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated && state.accessToken) {
          localStorage.setItem('access_token', state.accessToken)
        }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('auth:tokens-refreshed', ((event: CustomEvent<{ accessToken: string }>) => {
    useAuthStore.setState({ accessToken: event.detail.accessToken, isAuthenticated: true })
  }) as EventListener)
  window.addEventListener('auth:session-expired', () => {
    useAuthStore.getState().clearSession()
  })
}
