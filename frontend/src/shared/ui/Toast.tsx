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
 * 저장 · 삭제 피드백 (C03). **상태는 `shared/hooks/useToast` 를 쓰세요** — 직접
 * 들고 인라인 화살표를 onClose 로 넘기면 아래 타이머가 렌더마다 초기화됩니다.
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
      /*
        어두운 방(`styles/scent-display.css`)이 바탕을 반투명 흰색으로 다시 칠할 때
        잡는 자리입니다. 그 화면의 유리 카드 · 순위 동그라미와 같은 방식입니다 —
        `role="status"` 로 잡으면 나중에 생길 다른 알림 영역까지 함께 걸립니다.
      */
      data-slot="toast"
      className={cn(
        'bg-ink fixed bottom-6.25 left-1/2 z-40 -translate-x-1/2',
        'text-surface text-body shadow-overlay px-3.75 py-2.5',
        className,
      )}
    >
      {message}
    </div>
  )
}
