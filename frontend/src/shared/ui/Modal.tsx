import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

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
  /**
   * NOTE: 3D 카드(iframe)에서 여는 모달은 `panel` — 이 문서가 누름을 못 봐서, 첫 단추([×])로
   * 초점이 가면 브라우저가 키보드로 온 것으로 여겨 초점 테를 그린 채로 띄웁니다.
   */
  initialFocus?: 'first' | 'panel'
  titleSize?: 'title' | 'heading'
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
  initialFocus = 'first',
  titleSize = 'title',
  className,
}: ModalProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      if (initialFocus === 'panel') dialog.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, initialFocus])

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      tabIndex={initialFocus === 'panel' ? -1 : undefined}
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
        initialFocus === 'panel' && 'outline-none',
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
            'font-serif font-semibold',
            titleSize === 'heading' ? 'text-heading' : 'text-title',
            notice && 'text-center',
          )}
        >
          {title}
        </h2>

        {!notice && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('actions.close')}
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
