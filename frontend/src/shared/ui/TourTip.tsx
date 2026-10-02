import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

type Props = Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'role'> & {
  children: ReactNode
  /** [×] — 이 단계만 끝냅니다 */
  onClose: () => void
  /** [안내 그만 보기] — 남은 단계를 한꺼번에 끕니다 */
  onStopAll: () => void
}

/*
 * 누르는 순간 초점을 옮기지 않습니다 — 검색창 밑의 안내는 입력칸에 초점이 있는 동안만 서서, 초점이
 * 단추로 넘어가면 안내가 먼저 접히고 누름이 허공에 떨어집니다 (시작 문장과 같은 사정).
 * 키보드로 Tab 해 들어온 초점은 그대로 받습니다.
 */
const keepFocus = (event: MouseEvent) => event.preventDefault()

/**
 * 첫 방문 안내 한 줄 (`tourStore` · `useTourStep`). 그 요소 곁에 붙는 작은 종이이고 화면을 막지 않습니다 —
 * 어둡게 덮거나 초점을 가져가지 않아, 읽지 않고 하던 일을 이어 가도 됩니다.
 *
 * 3D 하늘 · 바다 위에도, 추천 결과의 유리판 위에도 같은 대비로 읽히게 상아색 종이 한 장입니다
 * (의견 단추의 인사 말풍선과 같은 종이).
 *
 * NOTE: `role="status"` 라 뜨는 순간 스크린리더가 읽습니다. 저절로 뜨는 말이지만 그 화면에서 처음
 * 할 일을 알려 주는 말이라 듣게 둡니다.
 */
export function TourTip({
  children,
  onClose,
  onStopAll,
  className,
  ...rest
}: Props) {
  const { t } = useTranslation('tour')

  return (
    <div
      {...rest}
      role="status"
      className={cn(
        'pointer-events-auto mx-auto w-fit max-w-[min(calc(100vw-var(--spacing)*10),calc(var(--spacing)*95))]',
        'bg-ivory/95 text-charcoal shadow-overlay rounded-[14px] py-2.5 pr-2.5 pl-3.75 backdrop-blur-[7px]',
        'transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
        'starting:-translate-y-1 starting:opacity-0',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="bg-accent-sunset mt-1.75 size-1.5 shrink-0 rounded-full"
        />
        <p className="text-left text-[12.5px] leading-relaxed break-keep">
          {children}
        </p>
        <button
          type="button"
          aria-label={t('tip.close')}
          onMouseDown={keepFocus}
          onClick={onClose}
          className={cn(
            '-mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
            'text-charcoal-soft hover:bg-charcoal/8 hover:text-charcoal',
            'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
          )}
        >
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="size-2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={onStopAll}
        className={cn(
          'text-charcoal-soft mt-0.5 ml-4 block rounded-sm text-[11px] underline-offset-2',
          'hover:text-charcoal hover:underline',
          'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
        )}
      >
        {t('tip.stopAll')}
      </button>
    </div>
  )
}
