import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('perfume')

  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75')}>
      <div className="flex items-center gap-2.5">
        <h2 className="text-ink text-title font-serif font-semibold">
          {t('reviewList.title')}
        </h2>
        {!isPending && (
          <span className="text-ink-muted text-caption">
            {t('reviewList.count', { count: totalElements })}
          </span>
        )}
        <AuthLinkButton
          to={
            myReviewId === null
              ? `${ROUTES.REVIEW_WRITE}?perfumeId=${perfumeId}`
              : toReviewEdit(myReviewId)
          }
          size="sm"
          className="ml-auto"
          description={t('reviewList.loginDescription')}
        >
          {myReviewId === null
            ? t('reviewList.write')
            : t('reviewList.editMine')}
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
          title={t('reviewList.emptyTitle')}
          description={t('reviewList.emptyDescription')}
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
          label={t('reviewList.pagination')}
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
  const { t } = useTranslation('perfume')

  return (
    <Link
      to={toReviewDetail(review.reviewId)}
      className="hover:bg-surface-sunken block space-y-1.25 px-2.5 py-3.75"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-ink text-heading font-serif font-semibold">
          {review.title}
        </span>
        {review.mine && (
          <span className="text-ink-muted text-caption">
            {t('reviewList.mine')}
          </span>
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
