import { useState } from 'react'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { RecommendedPerfume } from '../types'

type Props = {
  perfumes: RecommendedPerfume[]
  selectedId: number | null
  /** 카드를 누르면 그 향수가 미니맵에서 강조됩니다 */
  onSelect: (perfumeId: number) => void
}

/**
 * 자연어 추천 결과 카드 목록 (와이어프레임 A06 좌측 — NLR-06 · NLR-07)
 *
 * 와이어프레임 주석:
 * - 결과는 3~5개 가변 — 카드가 늘면 좌측 열이 스크롤된다 · 1번 카드만 펼친 상태
 * - 카드를 누르면 그 향수가 미니 맵에서 강조된다
 *
 * 추천 이유는 왜 이 향수가 나왔는지를 입력한 표현과 짝지어 보여줍니다.
 */
export function RecommendResultList({ perfumes, selectedId, onSelect }: Props) {
  // 1번 카드만 펼친 상태로 시작합니다
  const [expandedId, setExpandedId] = useState<number | null>(
    perfumes[0]?.perfumeId ?? null,
  )

  return (
    <ul className="max-h-127.5 space-y-2.5 overflow-y-auto pr-1.25">
      {perfumes.map((perfume, index) => {
        const expanded = expandedId === perfume.perfumeId
        const selected = selectedId === perfume.perfumeId

        return (
          <li key={perfume.perfumeId}>
            <article
              className={cn(
                'border-line bg-surface-card border p-2.5',
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
                className="flex w-full items-start gap-2.5 text-left"
              >
                <span className="bg-ink text-surface flex size-6.25 shrink-0 items-center justify-center text-[11px]">
                  {index + 1}
                </span>
                <Thumbnail
                  src={perfume.thumbnailUrl}
                  fallback="이미지"
                  className="size-16.25 shrink-0 text-[10px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-xs font-bold">
                    {perfume.name}
                  </span>
                  {/* 브랜드가 없는 향수가 있습니다 — 빈 줄을 남기지 않고 이름만 보입니다 */}
                  {perfume.brand && (
                    <span className="text-ink-muted block truncate text-[10.5px]">
                      {perfume.brand}
                    </span>
                  )}
                </span>
              </button>

              {expanded && (
                <div className="mt-2.5 space-y-2.5">
                  <p className="text-ink-muted text-[10.5px]">추천 이유</p>
                  <ul className="space-y-1.25">
                    {perfume.reasons.map((reason) => (
                      <li
                        key={reason.evidence}
                        className="text-ink text-[11px] leading-relaxed"
                      >
                        {reason.phrase ? (
                          <>
                            · &lsquo;{reason.phrase}&rsquo; → {reason.evidence}
                          </>
                        ) : (
                          <>· {reason.evidence}</>
                        )}
                      </li>
                    ))}
                  </ul>
                  <LinkButton
                    to={toPerfumeDetail(perfume.perfumeId)}
                    state={perfumeViewState('NATURAL_LANGUAGE_RECOMMENDATION')}
                    variant="outline"
                    size="sm"
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
