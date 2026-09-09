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
 * 와이어프레임 C03 의 "피드백 방식 통일" 은 **토스트로 확정**되었습니다.
 * 저장 · 삭제 · 생성 결과는 전부 이걸로 알립니다. 인라인 · 모달로 알리지 마세요.
 *
 * 상태는 직접 useState 로 들지 말고 shared/hooks/useToast 를 쓰세요.
 * 인라인 화살표를 onClose 로 넘기면 아래 타이머가 렌더마다 초기화됩니다.
 *
 *   const { showToast, toastProps } = useToast()
 *   <Toast {...toastProps} />
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
        'text-surface px-4 py-3 text-xs shadow-lg',
        className,
      )}
    >
      {message}
    </div>
  )
}
