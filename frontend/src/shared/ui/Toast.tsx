import { useEffect } from 'react'

import { cn } from '@/shared/lib/cn'

type ToastProps = {
  open: boolean
  onClose: () => void
  message: string
  /** 자동으로 사라지는 시간(ms). 0 이면 자동으로 닫지 않습니다. */
  duration?: number
  className?: string
}

/**
 * 저장 · 삭제 피드백 (와이어프레임 C03 — 화면 하단 고정 · 자동 사라짐)
 *
 * ⚠️ 와이어프레임 주석: "피드백 방식(토스트 · 인라인 · 모달)이 정해지면 한 방식으로 통일".
 * 지금은 와이어프레임에 그려진 대로 토스트로 만들어 두었습니다. 팀에서 다른 방식으로
 * 정하면 이 컴포넌트를 교체하고 호출부를 함께 고쳐야 합니다.
 *
 *   const [saved, setSaved] = useState(false)
 *   <Toast open={saved} onClose={() => setSaved(false)} message="진열대에 저장했습니다" />
 */
export function Toast({
  open,
  onClose,
  message,
  duration = 3000,
  className,
}: ToastProps) {
  useEffect(() => {
    if (!open || duration <= 0) return

    const timer = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timer)
  }, [open, duration, onClose])

  if (!open) return null

  return (
    <div
      // status 역할이라 화면 낭독기가 현재 작업을 끊지 않고 읽어줍니다
      role="status"
      aria-live="polite"
      className={cn(
        'bg-ink fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
        'px-4 py-3 text-xs text-white shadow-lg',
        className,
      )}
    >
      {message}
    </div>
  )
}
