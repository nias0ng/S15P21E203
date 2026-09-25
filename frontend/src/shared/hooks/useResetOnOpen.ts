import { useState } from 'react'

/**
 * 모달이 열릴 때마다 칸을 처음 값으로 되돌립니다.
 *
 * `Modal` 이 `<dialog>` 라 닫아도 언마운트되지 않아, 되돌리지 않으면 앞서 적던 값이 남습니다.
 * `useEffect` 가 아니라 렌더 중에 되돌리는 이유: 한 박자 늦으면 첫 프레임에 옛 값이 보입니다.
 *
 * `key` 가 바뀔 때마다 되돌립니다 — 닫혀서 `null` 이 될 때도 한 번 되돌립니다. 닫힌 채로
 * 처음 그려질 때만 되돌리지 않습니다.
 *
 * @param key 무엇으로 열렸는지. 닫혀 있으면 `null` 입니다. 같은 값이면 다시 되돌리지 않으므로
 *   매 렌더 새로 만들어지는 객체는 `JSON.stringify` 로 넘깁니다
 * @param reset 칸을 되돌리는 함수. 렌더 중에 불리므로 상태를 바꾸는 일만 합니다
 */
export function useResetOnOpen(key: string | null, reset: () => void): void {
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  if (key !== openedFor) {
    setOpenedFor(key)
    reset()
  }
}
