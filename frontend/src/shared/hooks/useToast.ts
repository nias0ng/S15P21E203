import { useCallback, useState } from 'react'

/**
 * 토스트 한 개의 열림 상태. **`onClose` 를 직접 만들어 쓰지 마세요** — 인라인
 * 화살표는 렌더마다 새 함수라 Toast 의 자동 닫힘 타이머가 계속 초기화됩니다.
 *
 *   const { showToast, toastProps } = useToast()
 *   <Toast {...toastProps} />
 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null)

  const showToast = useCallback((next: string) => setMessage(next), [])
  const closeToast = useCallback(() => setMessage(null), [])

  return {
    showToast,
    closeToast,
    /** `<Toast {...toastProps} />` 로 그대로 펼쳐 넣습니다. */
    toastProps: {
      open: message !== null,
      message: message ?? '',
      onClose: closeToast,
    },
  }
}
