import axios, { AxiosError, AxiosRequestConfig } from 'axios'

// Use same-origin API requests by default. Vite proxies /api to the local
// backend during development, and production can route /api through its proxy.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function expireClientSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  window.dispatchEvent(new Event('auth:session-expired'))
  if (window.location.pathname !== '/login') window.location.assign('/login')
}

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

// ── Request interceptor: attach JWT ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Let the browser set the multipart boundary. Keeping the JSON default here
  // causes some servers to receive an empty file from FormData requests.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete?.('Content-Type')
    if (config.headers['Content-Type']) delete config.headers['Content-Type']
    if (config.headers['content-type']) delete config.headers['content-type']
  }
  return config
})

// ── Response interceptor: handle 401 with token refresh ──────────────────────
let isRefreshing = false
let failedQueue: { resolve: (t: string) => void; reject: (e: any) => void }[] = []

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && originalRequest._retry) {
      expireClientSession()
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        expireClientSession()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return api(originalRequest)
        })
      }

      isRefreshing = true

      try {
        const response = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = response.data.data
        if (!accessToken || !newRefreshToken) throw new Error('The server did not return refreshed authentication tokens.')
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', newRefreshToken)
        window.dispatchEvent(new CustomEvent('auth:tokens-refreshed', { detail: { accessToken } }))
        processQueue(null, accessToken)
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
        }
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        expireClientSession()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    const message = (error.response?.data as any)?.message || error.message
    return Promise.reject(new Error(message))
  },
)

export default api
