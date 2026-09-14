import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { PersonalRecommendation } from '../types'

/** 접었을 때 화면에 남는 손잡이 띠의 폭. 아래 -translate-x-72 와 짝입니다 */
const BODY_WIDTH = 'w-72'

/**
 * 개인화 맞춤 향수 추천 카드 (REC-12 · REC-13)
 *
 * 화면 왼쪽 가장자리에 **오른쪽 끝만 내놓고** 붙어 있다가, 누르면 통째로 미끄러져
 * 나옵니다. 펼치면 추천 향수와 "왜 당신에게" 가 보입니다.
 *
 * 카드 하나가 통째로 움직입니다 — 접힌 상태의 띠와 펼친 상태의 카드가 따로 있는
 * 것이 아니라, 같은 카드가 왼쪽으로 물러나 있는 것입니다. 그래서 띠를 누르면
 * "숨어 있던 것이 나온다" 로 읽힙니다.
 *
 * 띠 위쪽의 ✕ 로 카드를 아예 치울 수 있습니다. 묻지 않았는데 온 것이라 "지금은
 * 됐다" 고 말할 방법이 있어야 합니다.
 *
 * 왜 진열대를 가리지 않는가: 세로 가운데에 붙되 본문 폭을 차지하지 않습니다.
 * 진열대 화면은 머리말~하단 띠가 한 화면에 들어가야 해서 세로로 넣을 자리가
 * 없고, 가로로 겹쳐 두면 병을 고르는 동안 계속 걸립니다.
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
   * 펼친 동안만 Esc 와 바깥 누르기를 듣습니다. 접혀 있을 때도 듣게 두면 이 화면의
   * 다른 Esc(모달 닫기)와 겹칩니다.
   *
   * 바깥 판정을 rootRef 기준으로 하는 이유: 띠를 누르는 순간에도 이 pointerdown 이
   * 같이 도착합니다. 카드 안이면 넘기지 않으면 열자마자 다시 닫힙니다.
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

  // 펼치면 카드 안으로 포커스를 옮깁니다. 키보드로 연 사람이 그대로 Tab 을 눌러
  // 추천 향수로 갈 수 있어야 합니다.
  useEffect(() => {
    if (open) bodyRef.current?.focus()
  }, [open])

  const { perfumeId, name, brand, thumbnailUrl, headline, reasons } =
    recommendation

  if (dismissed) return null

  return (
    // 세로 가운데. 헤더(z-10)보다 위이고 모달·토스트보다 아래입니다.
    <div ref={rootRef} className="fixed top-1/2 left-0 z-20 -translate-y-1/2">
      <div
        className={cn(
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
          // 접혀 있으면 화면 밖이라 낭독기와 탭 순서에서 뺍니다. 그대로 두면
          // 보이지도 않는 추천이 Tab 한 번에 잡힙니다.
          aria-hidden={!open}
          inert={!open}
          className={cn(
            BODY_WIDTH,
            'shrink-0 space-y-4 p-5 outline-none',
            // 세로로 길어져도 화면 밖으로 넘치지는 않게 합니다. 위아래 24px 씩
            // 남겨 두면 카드가 화면에 얹힌 것으로 보입니다.
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

          {/*
            이미지 · 이름 · 브랜드가 한 덩어리로 향수 상세로 갑니다. 셋을 따로
            링크로 만들면 같은 곳으로 가는 링크가 탭 순서에 세 번 잡힙니다.
          */}
          <Link
            to={toPerfumeDetail(perfumeId)}
            className={cn(
              'block space-y-2 rounded-md p-1 text-center',
              'focus-visible:ring-accent outline-none focus-visible:ring-2',
              'group',
            )}
          >
            {/*
              병 사진은 세로로 깁니다. contain 으로 두어 실루엣을 자르지 않습니다 —
              향수는 병 모양이 곧 정체성입니다.
            */}
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

        {/*
          손잡이 띠. 접힌 상태에서 화면에 남는 것이 이 띠뿐이라, 여기 글이 카드의
          첫인상입니다. 세로쓰기로 두는 이유는 띠 폭(48px)에 가로로는 두 글자밖에
          안 들어가서입니다.

          닫기와 펼치기를 **따로 둡니다.** 한 단추에 두 뜻을 담으면 "치우려고 눌렀는데
          펼쳐지는" 일이 생깁니다. 닫기가 위인 것은 접혀 있을 때도 이 띠가 화면에
          그대로 보여서, 위쪽 끝이 사람이 먼저 찾는 자리이기 때문입니다.
        */}
        <div className="border-line/50 flex w-12 shrink-0 flex-col border-l">
          <button
            type="button"
            aria-label="향수 추천 카드 닫기"
            onClick={() => setDismissed(true)}
            className={cn(
              'flex h-10 shrink-0 items-center justify-center',
              // 카드에서 가장 조용해야 하는 단추입니다. 추천을 보여주는 것이 이
              // 카드의 일이고 치우는 것은 그다음이라, 평소에는 물러나 있다가
              // 가리키면 진해집니다.
              //
              // /70 이 옅게 갈 수 있는 한계입니다. 카드 바탕(#fefcf8) 위에서 대비가
              // 3.19:1 이라 아이콘 기준 3:1 을 겨우 넘깁니다 — /65 는 2.88 로
              // 미달입니다. 더 옅게 하려면 색을 바꾸지 말고 크기를 키우세요.
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
              {open ? '접기' : '향수 추천이 왔어요!'}
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
