import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

type Props = {
  /** AI 요약. 후기가 적어 아직 만들지 않은 향수는 null 입니다 */
  summary: string | null
  /** 요약을 만들 때 쓴 후기 수 */
  sourceReviewCount: number | null
  isPending?: boolean
}

/**
 * 향수 상세 ④ AI 후기 요약 (A10 — DTL-23). 배치가 만들어 둔 **한 덩어리 글**이라
 * 퍼센트는 문장 안의 수치로만 씁니다.
 *
 * ⚠️ 브랜드 공식 향 설명이 여기 같이 있었지만 신뢰성 문제로 걷어냈습니다 — 상세
 * 응답의 `description` 은 화면 어디에서도 안 씁니다.
 */
export function PerfumeReviewSummary({
  summary,
  sourceReviewCount,
  isPending = false,
}: Props) {
  return (
    <section className={cn(GLASS_PANEL, 'space-y-2.5')}>
      <h2 className="text-ink text-title font-serif font-semibold">
        AI 후기 요약
      </h2>

      {isPending ? (
        <p className="text-ink-muted text-body">요약을 불러오는 중입니다.</p>
      ) : summary ? (
        <>
          <p className="text-ink text-body whitespace-pre-wrap">{summary}</p>
          {sourceReviewCount !== null && (
            <p className="text-ink-muted text-caption">
              후기 {sourceReviewCount}개를 바탕으로 요약했습니다.
            </p>
          )}
        </>
      ) : (
        <p className="text-ink-muted text-body">
          후기가 충분히 쌓이면 요약을 보여드립니다.
        </p>
      )}
    </section>
  )
}
