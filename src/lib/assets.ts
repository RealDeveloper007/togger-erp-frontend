const backendOrigin = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function isLoopback(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost')
}

export function resolveAssetUrl(url?: string | null) {
  if (!url) return ''
  if (/^(data:|blob:)/i.test(url)) return url

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      if (isLoopback(parsed.hostname)) return `${backendOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`
      return url
    } catch {
      return url
    }
  }

  const path = url.startsWith('/') ? url : `/${url}`
  return `${backendOrigin}${path}`
}
