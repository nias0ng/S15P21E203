import { useId, useState } from 'react'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { CARD_GRID } from '@/shared/ui/cardGrid'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PerfumeCard } from '@/shared/ui/PerfumeCard'

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
 * 자연어 추천 결과 (NLR-06 · NLR-07). 향수 목록과 같은 카드를 한 줄로 세우고, 카드를 누르면
 * 그 아래 칸에 그 향수의 추천 이유와 [자세히 보기]가 열립니다. 추천 이유는 입력한 표현과 향을
 * 짝지은 한 문장입니다(`nlrReasonSentence`).
 *
 * 이유를 카드 안에서 펼치지 않는 까닭: 다섯 장이 한 줄에 서는 좁은 카드에서 한 문장이 대여섯
 * 줄로 늘어나고, 한 장만 길어져도 같은 줄의 카드가 다 그 높이로 늘어납니다.
 */
export function RecommendResultList({ perfumes, ...context }: Props) {
  // 처음에는 다 닫혀 있습니다 — 다섯 장을 먼저 훑고 궁금한 것을 엽니다
  const [openId, setOpenId] = useState<number | null>(null)
  const reasonId = useId()
  const openIndex = perfumes.findIndex(
    (perfume) => perfume.perfumeId === openId,
  )
  const open = perfumes[openIndex]

  return (
    <>
      <ul className={CARD_GRID}>
        {perfumes.map((perfume, index) => (
          <li key={perfume.perfumeId}>
            <PerfumeCard
              name={perfume.name}
              subName={perfume.brand}
              rank={index + 1}
              rankLabel="추천"
              thumbnailUrl={perfume.thumbnailUrl}
              expanded={perfume.perfumeId === openId}
              controls={reasonId}
              onToggle={() =>
                setOpenId(
                  perfume.perfumeId === openId ? null : perfume.perfumeId,
                )
              }
            />
          </li>
        ))}
      </ul>

      {/* 닫혀 있어도 자리는 둡니다 — 카드의 `aria-controls` 가 가리키는 칸입니다 */}
      <div id={reasonId} className={cn(open && 'mt-5')}>
        {open && (
          <RecommendReason perfume={open} rank={openIndex + 1} {...context} />
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
  const sentence = nlrReasonSentence(perfume.reasons, context)

  return (
    <section
      aria-label={`${perfume.name} 추천 이유`}
      className="border-line bg-surface-sunken space-y-2.5 rounded-[18px] border p-3.75"
    >
      <p className="text-ink text-body font-medium">
        {rank} · {perfume.name}
      </p>
      {sentence && (
        <>
          <p className="text-ink-muted text-caption">
            추천 이유
            {sentence.showsStrength && ' · 괄호 안은 향 강도 0~100'}
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
        자세히 보기
      </LinkButton>
    </section>
  )
}
