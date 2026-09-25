import { useEffect } from 'react'

import { cn } from '@/shared/lib/cn'

type ToastProps = {
  open: boolean
  onClose: () => void
  message: string
}

const DURATION_MS = 3000

export function Toast({ open, onClose, message }: ToastProps) {
  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(onClose, DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-slot="toast"
      className={cn(
        'bg-ink fixed bottom-6.25 left-1/2 z-40 -translate-x-1/2',
        'text-surface text-body shadow-overlay px-3.75 py-2.5',
      )}
    >
      {message}
    </div>
  )
}
