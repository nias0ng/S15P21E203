import { useCallback, useState } from 'react'

/**
 * 토스트 한 개의 열림 상태. 저장 · 삭제 · 생성 결과는 전부 이 훅과 Toast 로 알립니다.
 *
 * **`onClose` 를 직접 만들어 쓰지 마세요.** 인라인 화살표로 넘기면 렌더마다 새 함수가
 * 되는데, Toast 의 자동 닫힘 useEffect 가 그걸 의존성으로 갖고 있어 타이머가 계속
 * 초기화됩니다. 여기서 useCallback 으로 identity 를 고정합니다.
 *
 *   const { showToast, toastProps } = useToast()
 *   showToast('진열대에 저장했습니다')
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
