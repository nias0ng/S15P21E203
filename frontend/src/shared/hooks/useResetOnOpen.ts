import { useState } from 'react'

export function useResetOnOpen(key: string | null, reset: () => void): void {
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  if (key !== openedFor) {
    setOpenedFor(key)
    reset()
  }
}
