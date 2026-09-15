type Props = {
  /** AI 요약. 후기가 적어 아직 만들지 않은 향수는 null 입니다 */
  summary: string | null
  /** 요약을 만들 때 쓴 후기 수 */
  sourceReviewCount: number | null
  /** 브랜드 공식 향 설명. 없는 향수는 null 로 옵니다 */
  description: string | null
  isPending?: boolean
}

/**
 * 향수 상세 ④ AI 후기 요약 + 브랜드 공식 향 설명 (와이어프레임 A10 — DTL-23)
 *
 * 와이어프레임에서 두 글 덩어리가 한 구역의 2열이라 함께 둡니다.
 *
 * 요약은 배치가 만들어 둔 **한 덩어리 글**입니다(문장 배열이 아닙니다). 퍼센트는
 * 문장 안의 수치로만 쓰고 막대는 쓰지 않습니다 — 그 자리는 계절별 평가가 맡습니다.
 */
export function PerfumeReviewSummary({
  summary,
  sourceReviewCount,
  description,
  isPending = false,
}: Props) {
  return (
    <section className="grid gap-6.25 p-6.25 sm:grid-cols-2">
      <div className="space-y-2.5">
        <h2 className="text-ink text-sm font-bold">AI 후기 요약</h2>

        {isPending ? (
          <p className="text-ink-muted text-xs">요약을 불러오는 중입니다.</p>
        ) : summary ? (
          <>
            <p className="text-ink text-xs leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
            {sourceReviewCount !== null && (
              <p className="text-ink-muted text-[10.5px]">
                후기 {sourceReviewCount}개를 바탕으로 요약했습니다.
              </p>
            )}
          </>
        ) : (
          <p className="text-ink-muted text-xs leading-relaxed">
            후기가 충분히 쌓이면 요약을 보여드립니다.
          </p>
        )}
      </div>

      <div className="space-y-2.5">
        <h2 className="text-ink text-sm font-bold">브랜드 공식 향 설명</h2>
        <p className="text-ink text-xs leading-relaxed">
          {description ?? '아직 등록된 설명이 없습니다.'}
        </p>
      </div>
    </section>
  )
}
