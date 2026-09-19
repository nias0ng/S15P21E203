import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { PersonalRecommendation } from '../types'

/** 접었을 때 화면에 남는 손잡이 띠의 폭. 아래 -translate-x-72 와 짝입니다 */
const BODY_WIDTH = 'w-72'

/**
 * 개인화 맞춤 향수 추천 카드 (REC-12 · REC-13)
 *
 * 화면 왼쪽 가장자리에 오른쪽 끝만 내놓고 붙어 있다가 누르면 미끄러져 나옵니다.
 * 묻지 않았는데 온 것이라 ✕ 로 아예 치울 수 있어야 합니다.
 */
export function RecommendPeekCard({
  recommendation,
}: {
  recommendation: PersonalRecommendation
}) {
  const [open, setOpen] = useState(false)
  /*
   * 닫으면 이 화면을 떠날 때까지 다시 뜨지 않습니다.
   *
   * ⚠️ 기억해 두지는 않습니다 — 화면을 다시 들어오면 또 나타납니다. "이 추천 그만
   * 보기" 를 계속 기억하려면 저장할 곳이 있어야 하는데, 그건 브라우저에 담을지
   * 계정에 담을지 정해야 하는 문제라 추천 API 를 붙일 때 함께 정합니다.
   */
  const [dismissed, setDismissed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const bodyId = useId()

  /*
   * 펼친 동안만 듣습니다 — 접혀 있을 때도 들으면 다른 Esc(모달 닫기)와 겹칩니다.
   * 바깥 판정이 rootRef 기준인 이유: 띠를 누르는 pointerdown 도 여기 도착해서,
   * 카드 안을 넘기지 않으면 열자마자 다시 닫힙니다.
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
      세로 가운데. 헤더(z-10)보다 위이고 모달·토스트보다 아래입니다.

      **빈 자리는 클릭을 먹지 않습니다.** 접혀 있을 때 안쪽이 `-translate-x-72` 로
      화면 밖에 나가도 바깥 상자는 그대로 337px 을 차지합니다 — transform 은 그림만
      옮기고 자리는 안 옮기기 때문입니다. 그래서 진열대 왼쪽 화살표와 병이 이
      보이지 않는 상자에 가려 안 눌렸습니다. 바깥은 통과시키고, 실제로 누를 수 있는
      안쪽만 다시 받게 합니다.
    */
    <div
      ref={rootRef}
      className="pointer-events-none fixed top-1/2 left-0 z-20 -translate-y-1/2"
    >
      <div
        className={cn(
          'pointer-events-auto',
          'border-line/50 bg-surface-card shadow-raised flex items-stretch',
          'rounded-r-panel overflow-hidden border border-l-0',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-72',
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
            // 세로로 길어져도 화면 밖으로 넘치지 않게 합니다
            'max-h-[calc(100dvh-3rem)] overflow-y-auto',
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
              'group',
            )}
          >
            {/* contain 으로 병 실루엣을 자르지 않습니다 */}
            <Thumbnail
              src={thumbnailUrl}
              fallback="이미지"
              fit="contain"
              className={cn(
                'bg-surface-veil rounded-card h-56 w-full border-transparent p-3',
                'group-hover:shadow-card transition-shadow duration-200 ease-out',
              )}
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
        <div className="border-line/50 flex w-12 shrink-0 flex-col border-l">
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
                open && 'rotate-180',
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
