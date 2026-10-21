export function BrandLoader({ label = 'Loading your workspace…' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
    <img src="/toggar-mark.svg" alt="Toggar" className="h-14 w-14 animate-bounce rounded-2xl bg-white p-1.5 shadow-lg" />
    <div>
      <p className="text-sm font-semibold text-foreground">Toggar ERP</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
    </div>
  </div>
}
