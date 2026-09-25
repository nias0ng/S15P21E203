import { useCallback, useSyncExternalStore } from 'react'

/**
 * 미디어 쿼리가 지금 맞는지 읽고, 창이 문턱을 넘으면 다시 그립니다.
 *
 * 첫 렌더에서 바로 맞는 값을 읽습니다 — effect 로 맞추면 첫 장이 `fallback` 으로 한 번
 * 그려졌다가 바뀌어 배치가 튑니다. `matchMedia` 가 없는 곳(테스트의 jsdom)에서는 던지지 않고
 * `fallback` 을 씁니다.
 *
 * @param query `(max-width: 1024px)` 같은 미디어 쿼리
 * @param fallback `matchMedia` 가 없을 때 · 서버 렌더에서 쓸 값
 * @returns 쿼리가 맞으면 true
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? fallback,
    () => fallback,
  )
}
