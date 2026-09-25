import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { apiErrorMessage } from '@/shared/api/http'
import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import {
  ROUTES,
  toPerfumeDetail,
  toReviewDetail,
  toReviewEdit,
} from '@/shared/config/routes'
import { useLikeToggle } from '@/shared/hooks/useLikeToggle'
import { authorName } from '@/shared/lib/authorName'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PAPER_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { deleteReview, likeReview, unlikeReview } from '../api'
import { perfumeDetailQuery, perfumeKeys, reviewKeys } from '../queries'
import { GENDER_TEXT } from '../types'
import type { ReviewDetail } from '../types'

type Props = {
  review: ReviewDetail
  /** 삭제 뒤 화면 이동은 부르는 쪽 몫입니다 — `features/perfume` 은 `features/community` 를 import 할 수 없습니다 */
  onDeleted: () => void
}

/**
 * 후기 상세 (A12). 어두운 방 · 유리판 구성은 docs/어두운-방-유리판.md 이고, 화면이
 * 수정 · 삭제를 숨기는 것과 별개로 백엔드도 작성자를 다시 확인합니다.
 */
export function PerfumeReviewDetail({ review, onDeleted }: Props) {
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  /* 사진 · 한국어 이름 · 성별은 **후기 응답에 없어** 향수 상세를 따로 부릅니다 */
  const perfume = useQuery(perfumeDetailQuery(review.perfume.perfumeId))
  const brandName = perfume.data?.brand?.name ?? review.perfume.brand
  /* 둘 다 없을 수 있어 배열로 모아 잇습니다 — 직접 붙이면 가운뎃점만 남습니다 */
  const sub = [
    perfume.data?.nameKo,
    perfume.data?.gender ? GENDER_TEXT[perfume.data.gender] : null,
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' · ')

  const removal = useMutation({
    mutationFn: () => deleteReview(review.reviewId),
    onSuccess: () => {
      setDeleteOpen(false)
      /* 지운 후기의 캐시를 남겨두면 뒤로가기로 그 화면이 다시 뜹니다 */
      queryClient.removeQueries({
        queryKey: reviewKeys.detail(review.reviewId),
      })
      void queryClient.invalidateQueries({
        queryKey: perfumeKeys.detail(review.perfume.perfumeId),
      })

      onDeleted()
    },
  })

  /** 다시 부르지 않고 캐시에 덮어씁니다 — 여는 것이 곧 조회라 조회수가 한 번 더 오릅니다 */
  const likeToggle = useLikeToggle({
    like: likeReview,
    unlike: unlikeReview,
    onToggled: (result) => {
      queryClient.setQueryData(
        reviewKeys.detail(review.reviewId),
        (old: ReviewDetail | undefined) =>
          old === undefined
            ? old
            : { ...old, liked: result.liked, likeCount: result.likeCount },
      )
    },
  })

  return (
    <article className={PAPER_PANEL}>
      <div className="space-y-3.75">
        <LinkButton to={ROUTES.COMMUNITY_REVIEWS} variant="outline" size="sm">
          ← 후기 게시판
        </LinkButton>

        <h1 className="text-ink text-title font-serif font-semibold">
          {review.title}
        </h1>

        <div className="flex items-center gap-2.5">
          {/* NOTE: 작성자 사진은 응답에 없습니다 — `ReviewDetailResponse` 가 닉네임만 줍니다.
              내 사진은 `GET /users/me` 로 알지만 남의 사진은 알 길이 없어, 필드를 요청해 뒀습니다 */}
          <Thumbnail className="size-7.5 shrink-0 rounded-full" />
          {/* 줄어드는 자리를 닉네임(최대 20자) 하나로 못 박습니다 — 상대시각과 오른쪽 단추 ·
              하트가 밀려 나가지 않게 합니다.
              NOTE: 1920 · 1536 에서는 이 줄에 여유가 있어(글 폭 800 · 640 에 최악값 약 485 · 473)
                아무 일도 하지 않습니다. 실제로 무는 것은 뷰포트가 700 아래로 내려간 좁은 화면입니다 */}
          <span className="text-ink min-w-0 truncate text-xs">
            {authorName(review.nickname)}
          </span>
          <span className="text-ink-muted text-caption shrink-0">
            · {formatRelativeTime(review.createdAt)}
          </span>

          <span className="ml-auto flex shrink-0 items-center gap-2.5">
            {review.mine && (
              <>
                <LinkButton
                  to={toReviewEdit(review.reviewId)}
                  variant="outline"
                  size="sm"
                >
                  수정
                </LinkButton>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                >
                  삭제
                </Button>
              </>
            )}

            {/* 비로그인은 보내 보지 않고 먼저 안내합니다 — 401 이 나면 인터셉터가 재발급을 시도하다 세션을 정리해 버립니다 */}
            <button
              type="button"
              aria-pressed={review.liked}
              aria-label={`좋아요 ${review.likeCount}`}
              disabled={likeToggle.isPending}
              onClick={() =>
                likeToggle.toggle({
                  id: review.reviewId,
                  liked: review.liked,
                })
              }
              className={cn(
                'rounded-card text-title leading-none',
                'transition-colors duration-120 ease-out',
                'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                review.liked ? 'text-like' : 'text-ink-muted hover:text-like',
              )}
            >
              <span aria-hidden>{review.liked ? '♥' : '♡'}</span>
            </button>
          </span>
        </div>

        <hr className="border-line" />

        <p className="text-ink text-xs leading-relaxed whitespace-pre-wrap">
          {review.content}
        </p>

        {review.seasons.length > 0 && (
          <div className="flex flex-wrap gap-1.25">
            {review.seasons.map((season) => (
              <Badge key={season.seasonId} tone="outline">
                {season.name}
              </Badge>
            ))}
          </div>
        )}

        {/* 들어온 길을 실어 보내 조회 기록에 "커뮤니티에서 왔다" 가 남습니다 */}
        <Link
          to={toPerfumeDetail(review.perfume.perfumeId)}
          state={perfumeViewState('COMMUNITY')}
          className={cn(
            // 흰 판 위라 테두리를 먹색으로 짙게 둡니다 — 유리판용 분홍(`accent-blush`)은 여기서 사라집니다
            'border-ink/30 hover:border-accent-sunset rounded-card',
            'flex items-center gap-3.75 border p-2.5',
            'transition-colors duration-120 ease-out',
            'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
          )}
        >
          <Thumbnail
            src={perfume.data?.images[0] ?? null}
            fit="contain"
            bare
            className="size-15 shrink-0"
          />

          <div className="min-w-0 space-y-0.5">
            {brandName && (
              <p className="text-ink-muted text-caption">{brandName}</p>
            )}
            <p className="text-ink text-body font-medium">
              {review.perfume.name}
            </p>
            {sub && <p className="text-ink-muted text-caption">{sub}</p>}
          </div>

          <span className="text-ink-muted text-caption ml-auto shrink-0">
            향수 상세 →
          </span>
        </Link>

        <hr className="border-line" />

        <p className="text-ink-muted text-caption">
          좋아요 {review.likeCount} · 조회 {review.viewCount}
        </p>

        {removal.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(
              removal.error,
              '삭제하지 못했습니다. 잠시 후 다시 시도해주세요.',
            )}
          </p>
        )}

        {likeToggle.error !== null && (
          <p className="text-danger text-caption" role="alert">
            좋아요를 누르지 못했습니다. 잠시 후 다시 시도해주세요.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => removal.mutate()}
        isLoading={removal.isPending}
      />

      <LoginRequiredDialog
        open={likeToggle.loginRequired}
        onClose={likeToggle.closeLoginRequired}
        redirectTo={toReviewDetail(review.reviewId)}
        description="좋아요는 로그인한 뒤에 누를 수 있습니다. 후기는 로그인 없이도 읽을 수 있습니다."
      />
    </article>
  )
}
