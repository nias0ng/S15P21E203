/**
 * 보는 사람이 움직임 줄이기를 켜 두었는지 읽습니다.
 *
 * `window` 나 `matchMedia` 가 없는 곳(테스트의 jsdom · 서버)에서도 던지지 않고 "안 켬" 으로
 * 봅니다 — 움직임을 그리는 쪽이 이 검사 하나 때문에 멈추면 안 됩니다.
 *
 * @returns 움직임 줄이기를 켰으면 true
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  )
}
