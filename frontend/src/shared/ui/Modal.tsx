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
  /**
   * **읽고 답만 하는 짧은 안내 모달** 모양 (확인 · 경고 C01). 제목이 가운데로
   * 모이고, [×] 가 빠지고, 단추 위 구분선을 걷고, 본문 숨이 넓어집니다.
   *
   * NOTE: **[×] 가 없으므로 닫는 단추를 `footer` 에 반드시 두세요** — Esc 와 배경
   * 클릭은 눈에 보이지 않아, 그것만으로는 나가는 길이 화면에 없습니다.
   *
   * 칸이 있는 모달에는 쓰지 마세요 — 입력이 왼쪽에서 시작해 축이 두 개가 됩니다.
   */
  notice?: boolean
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
  notice = false,
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
        'rounded-card m-auto w-127.5 max-w-[calc(100vw-var(--spacing)*10)] p-0',
        'backdrop:bg-ink/40 open:flex open:flex-col',
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

        {/*
          안내 모달에는 [×] 가 없습니다 — 나가는 길이 아래 [취소] 에 이미 있습니다.
          Esc 와 배경 클릭은 그대로입니다(`onCancel` · 배경 onClick).
        */}
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
            // 안내 모달에는 긋지 않습니다 — 나눌 층이 문장 한 덩이뿐입니다
            !notice && 'border-t',
          )}
        >
          {footer}
        </footer>
      )}
    </dialog>
  )
}
