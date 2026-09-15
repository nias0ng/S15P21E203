import { useParams } from 'react-router'

import { PerfumeReviewDetail, type Review } from '@/features/perfume'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'

/**
 * 후기 상세 (와이어프레임 A12 — DTL-03 · DTL-05 · DTL-06)
 *
 * ⚠️ 백엔드에 후기 조회 API 가 아직 없습니다. 와이어프레임을 눈으로 확인할 수 있도록
 * 아래 자리표시자를 쓰고 있습니다. API 가 준비되면 PLACEHOLDER 를 지우고
 * useQuery(reviewDetailQuery(reviewId)) 로 바꿔주세요.
 */
const PLACEHOLDER_REVIEW: Review = {
  reviewId: 0,
  nickname: '유저닉네임',
  content:
    '처음 뿌렸을 때 바다 냄새가 났다. 시간이 지나면서 나무 향이 올라오는데 여름 저녁에 특히 잘 맞았다.',
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  mine: true,
}

export default function ReviewDetailPage() {
  const { reviewId } = useParams<{ reviewId: string }>()

  // TODO: DTL-03 후기 조회 API 연결
  const review = PLACEHOLDER_REVIEW

  return (
    <div className="space-y-2.5">
      <PerfumeReviewDetail
        review={review}
        // TODO: 후기가 달린 향수 id 로 바꿔주세요 (응답에 포함될 예정)
        backTo={toPerfumeDetail(1)}
        editTo={ROUTES.REVIEW_WRITE}
      />
      <p className="text-ink-muted text-caption">
        ⚠️ 후기 조회 API 가 없어 자리표시자를 보여주고 있습니다. (reviewId:{' '}
        {reviewId})
      </p>
    </div>
  )
}
