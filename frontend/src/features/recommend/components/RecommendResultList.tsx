import { useLayoutEffect, useRef, useState } from 'react'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { FOCUS_RING } from '@/shared/ui/focusRing'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { accordLabel } from '../accordNames'
import type { RecommendedPerfume } from '../types'

type Props = {
  perfumes: RecommendedPerfume[]
  selectedId: number | null
  /** 카드를 누르면 그 향수가 미니맵에서 강조됩니다 */
  onSelect: (perfumeId: number) => void
}

/**
 * 다 접혔을 때의 목록 높이(px)를 재서 돌려줍니다. 목록이 그 높이를 지키면 카드를 펼쳐도
 * 판의 아래끝이 움직이지 않고, 넘치는 만큼만 목록 안에서 굴러갑니다.
 *
 * 값을 적지 않고 재는 까닭: 카드 높이는 `--spacing` 을 타 화면 폭마다 다르고 카드 사이
 * (`space-y-2.5`)까지 더해야 합니다. 적어 두면 카드 안쪽을 고칠 때 소리 없이 어긋납니다.
 *
 * **펼친 카드를 빼고 잽니다** — 접힌 카드는 다 같은 높이라 아무 한 장을 장수로 곱하면 다
 * 접힌 높이가 나옵니다. 그래서 펼쳐 둔 채 창을 줄여도 다시 잴 수 있습니다.
 *
 * NOTE: 글꼴이 늦게 와도 다시 잴 필요가 없습니다 — 카드 높이는 사진 받침(`size-20`)이
 *   정하고, 그 옆 글자 두 줄은 받침보다 낮아 높이에 닿지 않습니다.
 */
function useCollapsedListHeight(itemCount: number) {
  const listRef = useRef<HTMLUListElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current
      if (!list || itemCount === 0) return
      const items = Array.from(list.children) as HTMLElement[]
      const [first, second] = items
      const collapsed = items.find((li) => li.dataset.expanded !== 'true')
      if (!collapsed || !first) return

      const card = collapsed.getBoundingClientRect().height
      /*
        간격은 속성 이름이 아니라 **두 카드 사이의 빈 자리**로 잽니다. `space-y-*` 가 어느
        쪽 마진을 쓰는지는 Tailwind 판마다 다릅니다 — v4 는 `margin-bottom` 이라 `marginTop`
        을 읽으면 0 이 나오고, 잠긴 높이가 간격 수만큼 모자라 접힌 채로도 굴러갑니다.
        카드가 펼쳐져도 사이의 빈 자리는 그대로라 아무 때나 잴 수 있습니다.
      */
      const gap = second
        ? second.getBoundingClientRect().top -
          first.getBoundingClientRect().bottom
        : 0
      const next = items.length * card + (items.length - 1) * gap

      // 같은 값으로 다시 그리지 않습니다 — 부동소수 오차는 0.5px 안에서 무시합니다
      setHeight((prev) =>
        prev !== null && Math.abs(prev - next) < 0.5 ? prev : next,
      )
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [itemCount])

  return { listRef, height }
}

/** 자연어 추천 결과 카드 목록 (NLR-06 · NLR-07). 추천 이유를 입력한 표현과 짝지어 보여줍니다. */
export function RecommendResultList({ perfumes, selectedId, onSelect }: Props) {
  /* 처음에는 다 접혀 있습니다 — 그 높이가 목록을 잠그는 기준이고, 한 장만 열어 두면 그 카드가
     기준이 되어 목록이 처음부터 굴러갈 자리를 안고 섭니다 */
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const { listRef, height } = useCollapsedListHeight(perfumes.length)

  return (
    /*
      다 접힌 높이로 잠급니다. 카드를 펼치면 넘치는 만큼 **목록 안에서** 굴러가고 판은
      그대로입니다 — 상한만 두면 누르는 카드마다 다른 만큼(근거 개수를 탑니다) 판의 아래끝이
      내려가고, 판 높이를 못 박으면 접혔을 때 아래가 넓게 빕니다.

      NOTE: 접혔을 때는 높이가 내용과 정확히 같아 막대가 뜨지 않습니다. 그래서 "안에 더 있는
      것처럼 보인다" 는 걱정은 생기지 않습니다 — 막대는 펼쳤을 때만 나옵니다.
      NOTE: 막대 모양은 `styles/scent-display.css` 의 `.scent-thin-scroll` 입니다.
    */
    <ul
      ref={listRef}
      className={cn(
        'scent-thin-scroll space-y-2.5',
        height !== null && 'overflow-y-auto',
      )}
      style={height !== null ? { height } : undefined}
    >
      {perfumes.map((perfume, index) => {
        const expanded = expandedId === perfume.perfumeId
        const selected = selectedId === perfume.perfumeId

        return (
          <li key={perfume.perfumeId} data-expanded={expanded}>
            <article
              className={cn(
                'border-line bg-surface-card rounded-glass border p-2.5',
                selected && 'border-ink',
              )}
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => {
                  onSelect(perfume.perfumeId)
                  setExpandedId(expanded ? null : perfume.perfumeId)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 text-left',
                  FOCUS_RING,
                )}
              >
                <span className="bg-ink text-surface text-caption rounded-glass flex size-6.25 shrink-0 items-center justify-center">
                  {index + 1}
                </span>
                {/*
                  사진 뒤에 받침을 깔고 안쪽에 여백을 줍니다. 향수병 PNG 는 배경이 투명하고
                  세로로 길어, 상자에 꽉 채우면 병이 잘리거나 벽에 닿은 것처럼 보입니다
                  (엔진 카드의 `--pb-card-img-bg` 와 같은 받침입니다).
                */}
                <span className="border-line bg-surface-sunken rounded-glass flex size-20 shrink-0 items-center justify-center border p-1.25">
                  <Thumbnail
                    src={perfume.thumbnailUrl}
                    fallback="이미지"
                    fit="contain"
                    bare
                    className="text-caption size-full"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink text-body block truncate font-bold">
                    {perfume.name}
                  </span>
                  {/* 브랜드가 없는 향수가 있습니다 — 빈 줄을 남기지 않고 이름만 보입니다 */}
                  {perfume.brand && (
                    <span className="text-ink-muted text-caption mt-1.25 block truncate">
                      {perfume.brand}
                    </span>
                  )}
                </span>
              </button>

              {expanded && (
                <div className="border-line mt-2.5 space-y-2.5 border-t pt-2.5">
                  <p className="text-ink-muted text-caption">추천 이유</p>
                  <ul className="space-y-1.25">
                    {perfume.reasons.map((reason) => (
                      <li
                        key={reason.evidence}
                        className="text-ink text-caption leading-relaxed"
                      >
                        {/*
                          NOTE: 근거는 `citrus` 같은 **영어**로 옵니다. 번역은 백엔드
                          `AccordLabeler` 의 몫이지만 이름표가 아직 안 와서 영어가 그대로
                          나오고, 3D 향 지도의 향수 카드는 같은 향 특성을 이미 한국어로
                          보여줍니다. 한 서비스 안에서 두 말이 되지 않게 여기서 덮습니다.
                        */}
                        {reason.phrase ? (
                          <>
                            · &lsquo;{reason.phrase}&rsquo; →{' '}
                            {accordLabel(reason.evidence)}
                          </>
                        ) : (
                          <>· {accordLabel(reason.evidence)}</>
                        )}
                      </li>
                    ))}
                  </ul>
                  <LinkButton
                    to={toPerfumeDetail(perfume.perfumeId)}
                    state={perfumeViewState('NATURAL_LANGUAGE_RECOMMENDATION')}
                    variant="outline"
                    size="sm"
                    // 판 위의 단추는 엔진 카드 단추와 같은 남색입니다 (--pb-card-btn)
                    className="bg-navy hover:bg-navy/85"
                  >
                    자세히 보기
                  </LinkButton>
                </div>
              )}
            </article>
          </li>
        )
      })}
    </ul>
  )
}
