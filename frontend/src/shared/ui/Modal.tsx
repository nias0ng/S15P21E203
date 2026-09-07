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
 * 브라우저 기본 <dialog> 를 씁니다.
 *
 * 직접 div 로 만들면 포커스 가두기(모달 밖으로 Tab 이 나가지 않게), Esc 로 닫기,
 * 배경 스크롤 잠금을 전부 손으로 구현해야 합니다. showModal() 은 이걸 브라우저가
 * 해줍니다. 게시글 검수 보류 안내(CMT-13)처럼 모달이 필요한 곳에서 재사용합니다.
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

  // open prop 과 실제 dialog 상태를 맞춥니다.
  // <dialog open> 속성만 주면 모달이 아니라 그냥 보이는 요소가 되므로 showModal() 을 호출합니다.
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
      // Esc 키는 dialog 의 cancel 이벤트로 옵니다. 기본 동작(즉시 close)을 막고
      // 부모의 onClose 를 거쳐 닫아서 open 상태와 어긋나지 않게 합니다.
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
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="text-ink-muted hover:text-ink rounded p-1 text-lg leading-none"
        >
          ×
        </button>
      </header>

      <div className="px-5 py-4 text-sm">{children}</div>

      {footer && (
        <footer className="border-line flex justify-end gap-2 border-t px-5 py-4">
          {footer}
        </footer>
      )}
    </dialog>
  )
}
