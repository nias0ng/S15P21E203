import { Link } from 'react-router'

import { ROUTES, toReviewEdit, toReviewDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { AuthLinkButton } from '@/shared/ui/AuthLinkButton'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { Review } from '../types'

type Props = {
  reviews: Review[]
  /** 이 향수의 전체 후기 수 (DTL-10). 페이지 수를 세는 값이기도 합니다 */
  totalElements: number
  /** 0부터 시작합니다 */
  page: number
  size: number
  onPageChange: (page: number) => void
  isPending?: boolean
  /**
   * 이 향수에 내가 쓴 후기 번호. 있으면 [후기 쓰기] 대신 [후기 수정] 을 띄웁니다 —
   * 한 사람은 한 향수에 후기를 하나만 쓸 수 있어, 모르고 또 쓰면 409 로 막힙니다.
   */
  myReviewId: number | null
  /** 이 후기 목록이 달린 향수. 작성 화면에 실어 보내 미리 골라 둡니다 */
  perfumeId: number
}

/** 향수 상세 ⑤ 후기 (A10). [후기 쓰기]는 모달이 아니라 작성 화면(A24a)입니다 */
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
  const lastPage = Math.max(0, Math.ceil(totalElements / size) - 1)

  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75')}>
      <div className="flex items-center gap-2.5">
        <h2 className="text-ink text-title font-serif font-semibold">후기</h2>
        {!isPending && (
          <span className="text-ink-muted text-caption">{totalElements}개</span>
        )}
        {/*
          작성으로 갈 때는 이 향수를 주소에 실어 보냅니다 — 작성 화면이 그 향수를
          미리 골라 둡니다. 이미 쓴 후기가 있으면 수정으로 보냅니다(한 향수에 후기는
          하나라, 모르고 또 쓰면 409 로 막힙니다).
        */}
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

      {/* 페이지가 하나뿐이면 버튼을 아예 안 그립니다 — 늘 비활성인 버튼은 군더더기입니다 */}
      {!isPending && lastPage > 0 && (
        <div className="flex items-center justify-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
          >
            이전
          </Button>
          <span className="text-ink-muted text-caption">
            {page + 1} / {lastPage + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => onPageChange(page + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </section>
  )
}

/** 후기 한 줄. 누르면 후기 상세(A12)로 갑니다. */
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
        {/* 탈퇴한 회원의 후기는 글만 남고 작성자가 지워집니다 */}
        {review.nickname ?? '탈퇴한 회원'} ·{' '}
        {formatRelativeTime(review.createdAt)}
      </span>
    </Link>
  )
}
