import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { PersonalRecommendation } from '../types'

/** 접었을 때 화면에 남는 손잡이 띠의 폭. 아래 translate-x-72 와 짝입니다 */
const BODY_WIDTH = 'w-72'

/** 개인화 맞춤 추천 카드 (REC-12 · REC-13). 묻지 않았는데 온 것이라 아예 치울 수 있어야 합니다. */
export function RecommendPeekCard({
  recommendation,
}: {
  recommendation: PersonalRecommendation
}) {
  const [open, setOpen] = useState(false)
  // 닫으면 이 화면을 떠날 때까지만 안 뜹니다 — 어디에 기억할지는 추천 API 를 붙일 때 정합니다
  const [dismissed, setDismissed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const bodyId = useId()

  /*
   * 펼친 동안만 듣습니다 — 접혀 있을 때도 들으면 다른 Esc(모달 닫기)와 겹칩니다.
   * 바깥 판정은 띠까지 담은 rootRef 기준이어야 열자마자 다시 닫히지 않습니다.
   */
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  // 펼치면 카드 안으로 포커스를 옮깁니다 — 키보드로 연 사람이 이어서 Tab 할 수 있게
  useEffect(() => {
    if (open) bodyRef.current?.focus()
  }, [open])

  const { perfumeId, name, brand, thumbnailUrl, headline, reasons } =
    recommendation

  if (dismissed) return null

  return (
    /*
      NOTE: 접혀서 안쪽이 화면 밖에 나가도 바깥 상자는 자리를 그대로 차지해(transform 은
      그림만 옮깁니다) 뒤의 진열대를 가립니다 — 빈 자리는 클릭을 먹지 않게 둡니다.
    */
    <div
      ref={rootRef}
      className="pointer-events-none fixed top-[calc(var(--header-h)_+_var(--spacing)*5)] right-0 z-20"
    >
      <div
        className={cn(
          'pointer-events-auto',
          'border-line/50 bg-surface-card shadow-raised flex flex-row-reverse items-stretch',
          'overflow-hidden border border-r-0',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-72',
        )}
      >
        <div
          ref={bodyRef}
          id={bodyId}
          tabIndex={-1}
          // 접혀 있으면 화면 밖이라 낭독기와 탭 순서에서 뺍니다
          aria-hidden={!open}
          inert={!open}
          className={cn(
            BODY_WIDTH,
            'shrink-0 space-y-4 p-5 outline-none',
            // 위아래로 남기는 24씩. `--spacing` 을 곱해 다른 상자와 같은 비율로 줄입니다
            'max-h-[calc(100dvh-var(--header-h)-var(--spacing)*12)] overflow-y-auto',
          )}
        >
          <div className="space-y-1 text-center">
            <p className="text-ink-muted text-caption tracking-[0.18em] uppercase">
              For you
            </p>
            <p className="text-ink text-title font-serif font-semibold">
              {headline}
            </p>
          </div>

          {/* 셋을 따로 링크로 만들면 같은 곳이 탭 순서에 세 번 잡힙니다 */}
          <Link
            to={toPerfumeDetail(perfumeId)}
            state={perfumeViewState('PERSONALIZED_RECOMMENDATION')}
            className={cn(
              'block space-y-2 rounded-md p-1 text-center',
              'focus-visible:ring-accent outline-none focus-visible:ring-2',
            )}
          >
            {/* 향수병은 배경이 투명한 PNG 라 상자를 그리지 않습니다 — 테두리 · 바탕 둘 다 */}
            <Thumbnail
              src={thumbnailUrl}
              fallback="이미지"
              fit="contain"
              className="rounded-card h-56 w-full border-transparent bg-transparent p-3"
            />
            <span className="block space-y-0.5">
              <span className="text-ink text-title block font-serif font-semibold">
                {name}
              </span>
              <span className="text-ink-muted text-body block">{brand}</span>
            </span>
          </Link>

          <div className="border-line/50 space-y-2 border-t pt-4">
            <p className="text-ink-muted text-caption">왜 이 향이냐면</p>
            <ul className="space-y-1.5">
              {reasons.map((reason) => (
                <li
                  key={reason.evidence}
                  className="text-ink text-caption flex gap-2"
                >
                  <span aria-hidden className="text-ink-muted">
                    ·
                  </span>
                  <span>{reason.evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 닫기와 펼치기를 따로 둡니다 — 한 단추면 치우려다 펼쳐집니다 */}
        <div className="border-line/50 flex w-12 shrink-0 flex-col border-r">
          <button
            type="button"
            aria-label="향수 추천 카드 닫기"
            onClick={() => setDismissed(true)}
            className={cn(
              'flex h-10 shrink-0 items-center justify-center',
              'text-ink-muted/70 hover:text-ink transition-colors duration-120 ease-out',
              'focus-visible:ring-accent outline-none focus-visible:ring-2 focus-visible:ring-inset',
            )}
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              className="size-4"
            >
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>

          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((prev) => !prev)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-2 pb-6',
              'text-ink-muted hover:text-ink transition-colors duration-120 ease-out',
              'focus-visible:ring-accent outline-none focus-visible:ring-2 focus-visible:ring-inset',
            )}
          >
            <span className="text-caption tracking-[0.1em] [writing-mode:vertical-rl]">
              {open ? '접기' : '당신을 위한 향수 도착 :)'}
            </span>
            <span
              aria-hidden
              className={cn(
                'text-body transition-transform duration-200 ease-out',
                !open && 'rotate-180',
              )}
            >
              ›
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
