import { cn } from '@/shared/lib/cn'
import { splitSentences } from '@/shared/lib/splitSentences'
import { GLASS_PANEL } from '@/shared/ui/panel'

type Props = {
  summary: string | null
  sourceReviewCount: number | null
  isPending?: boolean
}

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
          <div className="text-ink text-body space-y-1.25">
            {splitSentences(summary).map((sentence, index) => (
              <p key={index}>{sentence}</p>
            ))}
          </div>
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
