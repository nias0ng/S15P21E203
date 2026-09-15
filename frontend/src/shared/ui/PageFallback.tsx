export function PageFallback() {
  return (
    <output
      aria-live="polite"
      className="flex min-h-60 w-full items-center justify-center"
    >
      <span className="border-line border-t-ink size-7.5 animate-spin rounded-full border-2" />
      <span className="sr-only">불러오는 중…</span>
    </output>
  )
}
