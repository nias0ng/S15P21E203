export function PageFallback() {
  return (
    <output
      aria-live="polite"
      className="flex min-h-60 w-full items-center justify-center"
    >
      <span className="border-brand-200 border-t-brand-600 size-8 animate-spin rounded-full border-2" />
      <span className="sr-only">불러오는 중…</span>
    </output>
  )
}
