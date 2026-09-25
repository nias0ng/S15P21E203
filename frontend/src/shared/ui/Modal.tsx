import { useEffect, useRef } from 'react'

import { cn } from '@/shared/lib/cn'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  /**
   * NOTE: **[×] 가 없으므로 닫는 단추를 `footer` 에 반드시 두세요**
   * — Esc 와 배경 클릭은 눈에 보이지 않아, 그것만으로는 나가는 길이 화면에 없습니다.
   *
   * 칸이 있는 모달에는 쓰지 마세요 — 입력이 왼쪽에서 시작해 축이 두 개가 됩니다.
   */
  notice?: boolean
  closeOnBackdrop?: boolean
  className?: string
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  notice = false,
  closeOnBackdrop = true,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (!closeOnBackdrop) return
        if (event.target === dialogRef.current) onClose()
      }}
      className={cn(
        'rounded-card m-auto w-127.5 max-w-[calc(100vw-var(--spacing)*10)] p-0',
        'backdrop:bg-ink/40 open:flex open:flex-col',
        'overflow-x-hidden',
        className,
      )}
    >
      <header
        className={cn(
          'border-line flex items-center border-b py-3.75',
          notice ? 'justify-center px-12.5' : 'justify-between px-5',
        )}
      >
        <h2
          className={cn(
            'text-title font-serif font-semibold',
            notice && 'text-center',
          )}
        >
          {title}
        </h2>

        {!notice && (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-ink-muted hover:text-ink rounded p-1.25 text-lg leading-none"
          >
            ×
          </button>
        )}
      </header>

      <div
        className={cn('text-body px-5', notice ? 'pt-10 pb-6.25' : 'py-3.75')}
      >
        {children}
      </div>

      {footer && (
        <footer
          className={cn(
            'border-line flex justify-end gap-2.5 px-5 py-3.75',
            !notice && 'border-t',
          )}
        >
          {footer}
        </footer>
      )}
    </dialog>
  )
}
