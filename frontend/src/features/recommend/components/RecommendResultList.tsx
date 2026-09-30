import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useLocale } from '@/shared/store/localeStore'
import { FOCUS_RING } from '@/shared/ui/focusRing'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import {
  nlrReasonSentence,
  type ReasonContext,
  type ReasonPart,
} from '../nlrReason'
import type { RecommendedPerfume } from '../types'

type Props = ReasonContext & {
  perfumes: RecommendedPerfume[]
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
      /*
        **못 재면 잠그지 않습니다.** 높이를 못 재는 환경(테스트의 jsdom 등)에서는 상자마다
        0 이 나오는데, 그 값을 그대로 박으면 목록이 `height: 0` 이 되어 통째로 사라집니다.
        잠그지 않으면 판이 내용을 따라 자랄 뿐이라, 안 되는 쪽이 훨씬 안전합니다
        (`useUnroll` 의 `CAN_MEASURE` 와 같은 규율입니다).
      */
      if (card <= 0) return

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

/**
 * 자연어 추천 결과 카드 목록 (NLR-06 · NLR-07). 추천 이유는 입력한 표현과 향을 짝지은 한
 * 문장입니다(`nlrReasonSentence`).
 */
export function RecommendResultList({ perfumes, ...context }: Props) {
  const { t } = useTranslation('recommend')
  const locale = useLocale()
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
        // 영어 화면은 원래 이름 · 브랜드를 씁니다. 그 칸을 모르는 서버면 한국어 쪽으로 돌아갑니다
        const name =
          locale === 'en'
            ? (perfume.originalName ?? perfume.name)
            : perfume.name
        const brand =
          locale === 'en'
            ? (perfume.originalBrand ?? perfume.brand)
            : perfume.brand

        return (
          <li key={perfume.perfumeId} data-expanded={expanded}>
            <article
              className={cn(
                'border-line bg-surface-card rounded-glass border p-2.5',
                expanded && 'border-ink',
              )}
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() =>
                  setExpandedId(expanded ? null : perfume.perfumeId)
                }
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
                    fallback={t('nlr.card.imageFallback')}
                    fit="contain"
                    bare
                    className="text-caption size-full"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink text-body block truncate font-bold">
                    {name}
                  </span>
                  {/* 브랜드가 없는 향수가 있습니다 — 빈 줄을 남기지 않고 이름만 보입니다 */}
                  {brand && (
                    <span className="text-ink-muted text-caption mt-1.25 block truncate">
                      {brand}
                    </span>
                  )}
                </span>
              </button>

              {expanded && (
                <div className="border-line mt-2.5 space-y-2.5 border-t pt-2.5">
                  <RecommendReasonText perfume={perfume} context={context} />
                  <LinkButton
                    to={toPerfumeDetail(perfume.perfumeId)}
                    state={perfumeViewState('NATURAL_LANGUAGE_RECOMMENDATION')}
                    variant="navy"
                    size="sm"
                  >
                    {t('nlr.card.viewDetails')}
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

/** 향 이름은 조금 굵게, 괄호 안 강도는 옅게 — 두세 줄로 길어져도 향 이름이 먼저 읽힙니다 */
const TONE_CLASS: Record<NonNullable<ReasonPart['tone']>, string> = {
  term: 'font-medium',
  strength: 'text-ink-muted',
}

/**
 * 추천 이유 머리글과 한 문장.
 *
 * NOTE: 괄호 안 숫자의 뜻은 **숫자를 하나라도 적었을 때만** 머리글에 씁니다. 강도가 오지 않는
 * 서버와 만나거나 향이 아닌 조건으로 고른 카드에는 숫자가 없어, 그때 뜻을 적으면 없는 괄호를
 * 설명하게 됩니다.
 */
function RecommendReasonText({
  perfume,
  context,
}: {
  perfume: RecommendedPerfume
  context: ReasonContext
}) {
  // 언어를 바꾸면 다시 그려야 이유 문장도 그 언어로 다시 짓습니다
  const { t } = useTranslation('recommend')
  const sentence = nlrReasonSentence(perfume.reasons, context)
  if (!sentence) return null

  return (
    <>
      <p className="text-ink-muted text-caption">
        {t('nlr.card.reasonTitle')}
        {sentence.showsStrength && t('nlr.card.strengthHint')}
      </p>
      <p className="text-ink text-caption leading-relaxed break-keep">
        {sentence.parts.map((part, index) => (
          <span key={index} className={part.tone && TONE_CLASS[part.tone]}>
            {part.text}
          </span>
        ))}
      </p>
    </>
  )
}
