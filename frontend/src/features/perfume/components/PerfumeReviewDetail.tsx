import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { isApiError } from '@/shared/api/http'
import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail, toReviewDetail } from '@/shared/config/routes'
import { useLikeToggle } from '@/shared/hooks/useLikeToggle'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { deleteReview, likeReview, unlikeReview } from '../api'
import { perfumeDetailQuery, perfumeKeys, reviewKeys } from '../queries'
import { GENDER_TEXT } from '../types'
import type { ReviewDetail } from '../types'

type Props = {
  review: ReviewDetail
  /** 후기 수정 화면 경로 (A24a 가 후기 대상을 걸고 열립니다) */
  editTo: string
  /**
   * 삭제 뒤 화면을 옮기는 일은 부르는 쪽이 합니다 — 커뮤니티 목록도 낡는데
   * `features/perfume` 은 `features/community` 를 import 할 수 없습니다.
   */
  onDeleted?: () => void
}

/**
 * 후기 상세 (A12 — DTL-03 · 05 · 06)
 *
 * `review.mine` 일 때만 수정 · 삭제를 그립니다. 화면에서 숨기는 것만으로는 권한이
 * 지켜지지 않아 백엔드도 작성자를 다시 확인합니다.
 *
 * 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md
 */
export function PerfumeReviewDetail({ review, editTo, onDeleted }: Props) {
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  /*
    사진 · 한국어 이름 · 성별은 **후기 응답에 없어** 향수 상세를 따로 부릅니다
    (`review.perfume` 은 번호 · 영문 이름 · 브랜드 셋뿐). 향수 상세 화면과 같은
    쿼리 키라 거기서 넘어왔으면 캐시에 있습니다.
  */
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
      /*
       * 지운 후기의 캐시를 남겨두면 뒤로가기로 그 화면이 다시 뜹니다.
       * 향수 상세의 후기 목록 · 계절 통계 · 요약도 함께 낡습니다.
       */
      queryClient.removeQueries({
        queryKey: reviewKeys.detail(review.reviewId),
      })
      void queryClient.invalidateQueries({
        queryKey: perfumeKeys.detail(review.perfume.perfumeId),
      })

      onDeleted?.()
    },
  })

  /**
   * 좋아요 토글 (CMT-05). 비로그인 안내 · 누르기/취소 고르기는 `useLikeToggle` 이
   * 맡고, 여기서는 캐시만 고칩니다 — 다시 부르지 않고 **응답 값을 이 후기에만
   * 덮어씁니다.** 다시 부르면 조회수가 한 번 더 오릅니다(여는 것이 곧 조회라서).
   */
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
    <article className={GLASS_PANEL}>
      <div className="space-y-3.75">
        {/* 예전에는 이 자리가 향수 상세로 가서, [뒤로] 에 오지 않은 곳이 적혀 있었습니다 */}
        <LinkButton to={ROUTES.COMMUNITY_REVIEWS} variant="outline" size="sm">
          ← 후기 게시판
        </LinkButton>

        <h1 className="text-ink text-title font-serif font-semibold">
          {review.title}
        </h1>

        <div className="flex items-center gap-2.5">
          {/* TODO: 프로필 이미지 연동 */}
          <Thumbnail className="size-7.5 shrink-0 rounded-full" />
          {/* 탈퇴한 회원의 후기는 글만 남고 작성자가 지워집니다 */}
          <span className="text-ink text-xs">
            {review.nickname ?? '탈퇴한 회원'}
          </span>
          <span className="text-ink-muted text-[10.5px]">
            · {formatRelativeTime(review.createdAt)}
          </span>

          <span className="ml-auto flex items-center gap-2.5">
            {review.mine && (
              <>
                <LinkButton to={editTo} variant="outline" size="sm">
                  수정
                </LinkButton>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={removal.isPending}
                  onClick={() => setDeleteOpen(true)}
                >
                  {removal.isPending ? '삭제 중' : '삭제'}
                </Button>
              </>
            )}

            {/*
              비로그인은 401 이라 보내 보지 않고 먼저 안내합니다 — 401 이 나면
              인터셉터가 재발급을 시도하다 세션을 정리해 버립니다.
            */}
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
                review.liked
                  ? 'text-danger'
                  : 'text-ink-muted hover:text-danger',
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
            'border-line hover:border-accent rounded-card',
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
            {/* 브랜드가 없는 향수가 있습니다 */}
            {brandName && (
              <p className="text-ink-muted text-caption">{brandName}</p>
            )}
            <p className="text-ink text-body font-medium">
              {review.perfume.name}
            </p>
            {/* 한국어 이름도 성별도 없으면 줄 자체를 그리지 않습니다 */}
            {sub && <p className="text-ink-muted text-caption">{sub}</p>}
          </div>

          <span className="text-ink-muted text-caption ml-auto shrink-0">
            향수 상세 →
          </span>
        </Link>

        <hr className="border-line" />

        {/* 조회수는 이번 조회를 포함한 수입니다 */}
        <p className="text-ink-muted text-[10.5px]">
          좋아요 {review.likeCount} · 조회 {review.viewCount}
        </p>

        {removal.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {isApiError(removal.error)
              ? removal.error.message
              : '삭제하지 못했습니다. 잠시 후 다시 시도해주세요.'}
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
