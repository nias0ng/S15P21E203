import { useCallback, useState } from 'react'

/**
 * 토스트 한 개의 열림 상태를 관리합니다.
 *
 * 이 훅을 만들기 전에는 4개 페이지가 각자 아래를 반복하고 있었습니다.
 *
 *   const [toast, setToast] = useState<string | null>(null)
 *   <Toast open={toast !== null} onClose={() => setToast(null)} message={toast ?? ''} />
 *
 * onClose 를 인라인 화살표로 넘기면 렌더마다 새 함수가 만들어집니다. Toast 의
 * 자동 닫힘 useEffect 가 onClose 를 의존성으로 갖고 있어서, 그 페이지가 3초보다
 * 자주 렌더되면 타이머가 계속 초기화되어 토스트가 안 사라집니다.
 * 여기서 useCallback 으로 함수 identity 를 고정해 그 문제를 없앱니다.
 *
 * 와이어프레임 C03 의 피드백 방식은 **토스트로 확정**되었습니다.
 * 저장 · 삭제 · 생성 결과는 전부 이 훅과 Toast 로 알립니다.
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
