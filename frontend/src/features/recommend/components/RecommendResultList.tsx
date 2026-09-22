import { useState } from 'react'

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

/** 자연어 추천 결과 카드 목록 (NLR-06 · NLR-07). 추천 이유를 입력한 표현과 짝지어 보여줍니다. */
export function RecommendResultList({ perfumes, selectedId, onSelect }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(
    perfumes[0]?.perfumeId ?? null,
  )

  return (
    /*
      NOTE: 휠로 굴리지 않습니다. 결과는 많아야 다섯 개라(응답 계약) 한 화면에 다 섭니다 —
      스크롤을 두면 안에 더 있는 것처럼 보이고, 판이 3D 위에 떠 있어 안쪽 스크롤이 배경의
      3D 조작과 섞입니다.
    */
    <ul className="space-y-2.5">
      {perfumes.map((perfume, index) => {
        const expanded = expandedId === perfume.perfumeId
        const selected = selectedId === perfume.perfumeId

        return (
          <li key={perfume.perfumeId}>
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
