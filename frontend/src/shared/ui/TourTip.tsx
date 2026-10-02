import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

type Props = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'role' | 'onClick'
> & {
  children: ReactNode
  /** [×] — 이 단계만 끝냅니다 */
  onClose: () => void
  /** [안내 그만 보기] — 남은 단계를 한꺼번에 끕니다 */
  onStopAll: () => void
  /**
   * 안내를 눌렀습니다 — 그 행동을 안 해도 다음 안내로 넘깁니다. 안내 어디를 눌러도 되고, 키보드는 [다음 →] 으로 옵니다.
   * 안 주면 누를 수 없는 한 줄입니다.
   */
  onNext?: () => void
}

/*
 * 누르는 순간 초점을 옮기지 않습니다 — 검색창 밑의 안내는 입력칸에 초점이 있는 동안만 서서, 초점이
 * 단추로 넘어가면 안내가 먼저 접히고 누름이 허공에 떨어집니다 (시작 문장과 같은 사정).
 * 키보드로 Tab 해 들어온 초점은 그대로 받습니다.
 */
const keepFocus = (event: MouseEvent) => event.preventDefault()

/**
 * 첫 방문 안내 한 줄 (`tourStore` · `useTourStep`). 그 요소 곁에 붙는 작은 종이입니다. 종이 자신은 화면을
 * 덮지도 초점을 가져가지도 않습니다 — 누를 때도 초점을 그대로 둡니다(위 `keepFocus`).
 *
 * NOTE: 메인 화면에서는 `TourSpotlight`(`features/map`)가 안내가 서 있는 동안 그 둘레를 어둡게 덮고
 *   키보드 초점을 이 안내의 단추로 옮깁니다. 그쪽이 이 종이를 찾는 표시가 뿌리의 `data-tour-tip` 입니다 —
 *   부르는 쪽의 `...rest` 가 지우지 못하게 그 뒤에 둡니다.
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
  onNext,
  className,
  ...rest
}: Props) {
  const { t } = useTranslation('tour')

  return (
    <div
      {...rest}
      data-tour-tip=""
      role="status"
      onMouseDown={keepFocus}
      // 안의 단추([×] · 안내 그만 보기 · 다음)는 제 일을 합니다 — 그 밖을 누른 것만 '다음' 입니다
      onClick={(event) => {
        if (!onNext) return
        if ((event.target as HTMLElement).closest('button')) return
        onNext()
      }}
      className={cn(
        'pointer-events-auto mx-auto w-fit max-w-[min(calc(100vw-var(--spacing)*10),calc(var(--spacing)*95))]',
        'bg-ivory/95 text-charcoal shadow-overlay rounded-[14px] py-2.5 pr-2.5 pl-3.75 backdrop-blur-[7px]',
        'transition-[opacity,translate,background-color] duration-200 ease-out motion-reduce:transition-none',
        'starting:-translate-y-1 starting:opacity-0',
        onNext && 'hover:bg-ivory cursor-pointer',
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
      <div className="mt-0.5 ml-4 flex items-center justify-between gap-5">
        <button
          type="button"
          onClick={onStopAll}
          className={cn(
            'text-charcoal-soft rounded-sm text-[11px] underline-offset-2',
            'hover:text-charcoal hover:underline',
            'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
          )}
        >
          {t('tip.stopAll')}
        </button>
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className={cn(
              'text-charcoal rounded-sm text-[11.5px] font-medium',
              'hover:text-accent-deep',
              'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
            )}
          >
            {t('tip.next')} →
          </button>
        )}
      </div>
    </div>
  )
}
