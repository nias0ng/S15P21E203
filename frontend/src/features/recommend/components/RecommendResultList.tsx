import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { useTourStep } from '@/shared/hooks/useTourStep'
import type { Locale } from '@/shared/i18n/locale'
import { cn } from '@/shared/lib/cn'
import { useLocale } from '@/shared/store/localeStore'
import { useTourStore } from '@/shared/store/tourStore'
import { CARD_GRID } from '@/shared/ui/cardGrid'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PerfumeCard } from '@/shared/ui/PerfumeCard'
import { TourTip } from '@/shared/ui/TourTip'

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
 * 영어 화면은 원래 이름 · 브랜드를 씁니다. 서버의 `name` · `brand` 는 한국어 우선이라서입니다.
 * 원래 이름 칸을 모르는 서버면 한국어 쪽으로 돌아갑니다.
 */
function displayNames(locale: Locale, perfume: RecommendedPerfume) {
  if (locale !== 'en') {
    return { name: perfume.name, brand: perfume.brand }
  }
  return {
    name: perfume.originalName ?? perfume.name,
    brand: perfume.originalBrand ?? perfume.brand,
  }
}

/**
 * 자연어 추천 결과 (NLR-06 · NLR-07). 향수 목록과 같은 카드를 한 줄로 세우고, 카드를 누르면
 * 그 아래 칸에 그 향수의 추천 이유와 [자세히 보기]가 열립니다. 추천 이유는 입력한 표현과 향을
 * 짝지은 한 문장입니다(`nlrReasonSentence`).
 *
 * 이유를 카드 안에서 펼치지 않는 까닭: 다섯 장이 한 줄에 서는 좁은 카드에서 한 문장이 대여섯
 * 줄로 늘어나고, 한 장만 길어져도 같은 줄의 카드가 다 그 높이로 늘어납니다.
 */
export function RecommendResultList({ perfumes, ...context }: Props) {
  const { t } = useTranslation(['recommend', 'tour'])
  const locale = useLocale()
  // 처음에는 다 닫혀 있습니다 — 다섯 장을 먼저 훑고 궁금한 것을 엽니다
  const [openId, setOpenId] = useState<number | null>(null)
  const reasonId = useId()
  const openIndex = perfumes.findIndex(
    (perfume) => perfume.perfumeId === openId,
  )
  const open = perfumes[openIndex]
  /*
    첫 방문 안내 — 처음 받은 결과에서 카드를 누르면 이유가 펼쳐진다는 것을 이유가 설 자리에 적습니다
    (`tourStore` 의 results). 처음 온 사람은 카드가 상세로 가는 링크인 줄 알고 이름만 보고 골랐습니다.
    카드를 하나 펼치면 끝납니다 · 결과창을 닫는 것은 `RecommendModal` 이 끝냅니다.
  */
  const tip = useTourStep('results', true)
  const stopTour = useTourStore((state) => state.stop)

  return (
    <>
      {/* 메인의 `TourSpotlight` 가 results 안내 동안 밝혀 두는 자리 — 안내가 말하는 카드 격자입니다 */}
      <ul data-tour-target="results" className={CARD_GRID}>
        {perfumes.map((perfume, index) => {
          const { name, brand } = displayNames(locale, perfume)
          return (
            <li key={perfume.perfumeId}>
              <PerfumeCard
                name={name}
                subName={brand}
                rank={index + 1}
                rankLabel={t('nlr.card.rankLabel')}
                thumbnailUrl={perfume.thumbnailUrl}
                expanded={perfume.perfumeId === openId}
                controls={reasonId}
                onToggle={() => {
                  tip.finish()
                  setOpenId(
                    perfume.perfumeId === openId ? null : perfume.perfumeId,
                  )
                }}
              />
            </li>
          )
        })}
      </ul>

      {/* 닫혀 있어도 자리는 둡니다 — 카드의 `aria-controls` 가 가리키는 칸입니다 */}
      <div id={reasonId} className={cn((open || tip.showing) && 'mt-5')}>
        {open ? (
          <RecommendReason perfume={open} rank={openIndex + 1} {...context} />
        ) : (
          tip.showing && (
            <TourTip
              onClose={tip.finish}
              onNext={tip.next}
              onStopAll={stopTour}
            >
              {t('tour:results')}
            </TourTip>
          )
        )}
      </div>
    </>
  )
}

/** 향 이름은 조금 굵게, 괄호 안 강도는 옅게 — 두세 줄로 길어져도 향 이름이 먼저 읽힙니다 */
const TONE_CLASS: Record<NonNullable<ReasonPart['tone']>, string> = {
  term: 'font-medium',
  strength: 'text-ink-muted',
}

/**
 * 연 카드의 추천 이유 칸 — 머리글 · 한 문장 · [자세히 보기].
 *
 * NOTE: 괄호 안 숫자의 뜻은 **숫자를 하나라도 적었을 때만** 머리글에 씁니다. 강도가 오지 않는
 * 서버와 만나거나 향이 아닌 조건으로 고른 향수에는 숫자가 없어, 그때 뜻을 적으면 없는 괄호를
 * 설명하게 됩니다.
 * NOTE: 이유를 못 지은 향수도 칸은 엽니다 — [자세히 보기]까지 사라지면 그 카드는 눌러도
 * 아무 데도 못 갑니다.
 */
function RecommendReason({
  perfume,
  rank,
  ...context
}: ReasonContext & { perfume: RecommendedPerfume; rank: number }) {
  // 언어를 바꾸면 다시 그려야 이유 문장도 그 언어로 다시 짓습니다
  const { t } = useTranslation('recommend')
  const { name } = displayNames(useLocale(), perfume)
  const sentence = nlrReasonSentence(perfume.reasons, context)

  return (
    <section
      aria-label={t('nlr.card.reasonLabel', { name })}
      className="border-line bg-surface-sunken space-y-2.5 rounded-[18px] border p-3.75"
    >
      <p className="text-ink text-body font-medium">
        {rank} · {name}
      </p>
      {sentence && (
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
      )}
      {/*
        판(`scent-map-glass`)은 글자가 흰색이라 남색 단추입니다 — 먹색 단추(`primary`)는 이 판
        위에서 흰 바탕에 상아색 글자가 되어 글씨가 사라집니다.
      */}
      <LinkButton
        to={toPerfumeDetail(perfume.perfumeId)}
        state={perfumeViewState('NATURAL_LANGUAGE_RECOMMENDATION')}
        variant="navy"
        size="sm"
      >
        {t('nlr.card.viewDetails')}
      </LinkButton>
    </section>
  )
}
