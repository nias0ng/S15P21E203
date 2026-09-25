import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { communityKeys } from '@/features/community'
import { PerfumeReviewDetail, reviewDetailQuery } from '@/features/perfume'
import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { parseId } from '@/shared/lib/parseId'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'

export default function ReviewDetailPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { reviewId } = useParams<{ reviewId: string }>()
  const numericId = parseId(reviewId)
  const valid = numericId !== null

  const { data, isPending, isError, refetch } = useQuery({
    ...reviewDetailQuery(numericId ?? 0),
    enabled: valid,
  })

  if (valid && isPending) return <PageFallback />

  if (!valid || isError || !data) {
    return (
      <EmptyState
        title="후기를 찾을 수 없습니다"
        description="주소가 잘못되었거나 삭제된 후기입니다."
        action={
          <LinkButton to={ROUTES.COMMUNITY_REVIEWS} variant="outline" size="sm">
            후기 게시판으로
          </LinkButton>
        }
        onRetry={valid ? () => refetch() : undefined}
        retrySize="sm"
      />
    )
  }

  return (
    <PerfumeReviewDetail
      review={data}
      onDeleted={() => {
        void queryClient.invalidateQueries({ queryKey: communityKeys.all })
        navigate(toPerfumeDetail(data.perfume.perfumeId), {
          replace: true,
          state: perfumeViewState('COMMUNITY'),
        })
      }}
    />
  )
}
