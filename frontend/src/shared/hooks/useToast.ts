import { useCallback, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)

  const showToast = useCallback((next: string) => setMessage(next), [])
  const closeToast = useCallback(() => setMessage(null), [])

  return {
    showToast,
    toastProps: {
      open: message !== null,
      message: message ?? '',
      onClose: closeToast,
    },
  }
}
