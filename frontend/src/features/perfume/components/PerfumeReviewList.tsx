import { Link } from 'react-router'

import { ROUTES, toReviewEdit, toReviewDetail } from '@/shared/config/routes'
import { authorName } from '@/shared/lib/authorName'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { AuthLinkButton } from '@/shared/ui/AuthLinkButton'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { Review } from '../types'

type Props = {
  reviews: Review[]
  totalElements: number
  page: number
  size: number
  onPageChange: (page: number) => void
  isPending?: boolean
  myReviewId: number | null
  perfumeId: number
}

export function PerfumeReviewList({
  reviews,
  totalElements,
  page,
  size,
  onPageChange,
  isPending = false,
  myReviewId,
  perfumeId,
}: Props) {
  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75')}>
      <div className="flex items-center gap-2.5">
        <h2 className="text-ink text-title font-serif font-semibold">후기</h2>
        {!isPending && (
          <span className="text-ink-muted text-caption">{totalElements}개</span>
        )}
        <AuthLinkButton
          to={
            myReviewId === null
              ? `${ROUTES.REVIEW_WRITE}?perfumeId=${perfumeId}`
              : toReviewEdit(myReviewId)
          }
          size="sm"
          className="ml-auto"
          description="후기는 로그인한 뒤에 쓸 수 있습니다."
        >
          {myReviewId === null ? '후기 쓰기' : '내 후기 수정'}
        </AuthLinkButton>
      </div>

      {isPending ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          title="아직 후기가 없습니다"
          description="이 향수를 시향했다면 첫 후기를 남겨보세요."
        />
      ) : (
        <ul className="divide-line divide-y">
          {reviews.map((review) => (
            <li key={review.reviewId}>
              <ReviewRow review={review} />
            </li>
          ))}
        </ul>
      )}

      {!isPending && (
        <Pagination
          label="후기 페이지"
          page={page}
          size={size}
          totalElements={totalElements}
          onPageChange={onPageChange}
        />
      )}
    </section>
  )
}

function ReviewRow({ review }: { review: Review }) {
  return (
    <Link
      to={toReviewDetail(review.reviewId)}
      className="hover:bg-surface-sunken block space-y-1.25 px-2.5 py-3.75"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-ink text-body font-medium">{review.title}</span>
        {review.mine && (
          <span className="text-ink-muted text-caption">내 후기</span>
        )}
      </span>

      <span className="text-ink-muted text-body block truncate">
        {review.content}
      </span>

      <span className="text-ink-muted text-caption block">
        {authorName(review.nickname)} · {formatRelativeTime(review.createdAt)}
      </span>
    </Link>
  )
}
