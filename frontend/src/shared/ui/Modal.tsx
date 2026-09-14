import { useEffect, useRef } from 'react'

import { cn } from '@/shared/lib/cn'

type ModalProps = {
  open: boolean
  /** 닫기 요청(Esc, 배경 클릭, 닫기 버튼). 부모가 open 을 false 로 바꿔야 실제로 닫힙니다. */
  onClose: () => void
  title: string
  children: React.ReactNode
  /** 하단 버튼 영역 */
  footer?: React.ReactNode
  className?: string
}

/**
 * 브라우저 기본 `<dialog>` 를 씁니다. div 로 만들면 포커스 가두기 · Esc · 배경 스크롤
 * 잠금을 전부 손으로 구현해야 하는데 `showModal()` 이 그걸 해줍니다.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // `<dialog open>` 속성만 주면 모달이 아니라 그냥 보이는 요소라 showModal() 을 씁니다
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      // Esc 의 기본 동작(즉시 close)을 막고 부모의 onClose 를 거칩니다 — 안 그러면
      // dialog 는 닫혔는데 open prop 은 true 로 남습니다
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // 배경(dialog 자체)을 클릭했을 때만 닫습니다. 내용 클릭은 통과시킵니다.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      className={cn(
        'rounded-card m-auto w-[min(32rem,calc(100vw-2rem))] p-0',
        'backdrop:bg-ink/40 open:flex open:flex-col',
        className,
      )}
    >
      <header className="border-line flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-title font-serif font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="text-ink-muted hover:text-ink rounded p-1 text-lg leading-none"
        >
          ×
        </button>
      </header>

      <div className="text-body px-5 py-4">{children}</div>

      {footer && (
        <footer className="border-line flex justify-end gap-2 border-t px-5 py-4">
          {footer}
        </footer>
      )}
    </dialog>
  )
}
