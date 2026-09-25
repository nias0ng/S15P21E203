import { useEffect } from 'react'

import { useDiveStore } from '@/shared/store/diveStore'

export function useDiveReady(ready: boolean, graceMs = 0) {
  const markReady = useDiveStore((state) => state.markReady)

  useEffect(() => {
    if (!ready) return
    let timer = 0
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        if (graceMs <= 0) {
          markReady()
          return
        }
        timer = window.setTimeout(markReady, graceMs)
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [ready, graceMs, markReady])
}
