import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { PerfumeReviewDetail, reviewDetailQuery } from '@/features/perfume'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'

/**
 * 후기 상세 (와이어프레임 A12 — DTL-03 · DTL-05 · DTL-06)
 *
 * 비로그인도 볼 수 있습니다. **여는 것이 곧 조회라 조회수가 하나 오릅니다** —
 * 그래서 쿼리에서 창 포커스 · 재연결 재요청을 꺼 두었습니다(queries.ts).
 */
export default function ReviewDetailPage() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const numericId = Number(reviewId)
  const valid = Number.isFinite(numericId)

  const { data, isPending, isError, refetch } = useQuery({
    ...reviewDetailQuery(numericId),
    enabled: valid,
  })

  if (valid && isPending) return <PageFallback />

  // 없는 reviewId 와 불러오기 실패를 같은 안내로 묶습니다 — 할 일이 같습니다
  if (!valid || isError || !data) {
    return (
      <EmptyState
        title="후기를 찾을 수 없습니다"
        description="주소가 잘못되었거나 삭제된 후기입니다."
        action={
          <div className="flex gap-2.5">
            <LinkButton
              to={ROUTES.COMMUNITY_REVIEWS}
              variant="outline"
              size="sm"
            >
              후기 게시판으로
            </LinkButton>
            {valid && (
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                다시 시도
              </Button>
            )}
          </div>
        }
      />
    )
  }

  return (
    <PerfumeReviewDetail
      review={data}
      backTo={toPerfumeDetail(data.perfume.perfumeId)}
      // TODO: 작성 화면에 수정할 후기를 실어 보내기 — A24a 연결 시
      editTo={ROUTES.REVIEW_WRITE}
    />
  )
}
