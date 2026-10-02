import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { localizedBrand, localizedName } from '@/shared/i18n/locale'
import { authorName } from '@/shared/lib/authorName'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { useLocale } from '@/shared/store/localeStore'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PAPER_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { deleteReview, likeReview, unlikeReview } from '../api'
import { perfumeDetailQuery, perfumeKeys, reviewKeys } from '../queries'
import { readGenderFilter } from '../types'
import type { ReviewDetail } from '../types'

type Props = {
  review: ReviewDetail
  onDeleted: () => void
}

export function PerfumeReviewDetail({ review, onDeleted }: Props) {
  const { t } = useTranslation('perfume')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const perfume = useQuery(perfumeDetailQuery(review.perfume.perfumeId))
  const brandName =
    localizedBrand(locale, review.perfume.brand, review.perfume.brandKo) ??
    perfume.data?.brand?.name ??
    null
  /*
    이름 줄은 화면 언어의 이름이고, 한국어 화면에서 한국어 이름을 썼으면 원래 이름을 아래에 답니다.
    한국어 이름을 모르는 서버면 향수 상세의 한국어 이름으로 채웁니다.
  */
  const title = localizedName(
    locale,
    review.perfume.name,
    review.perfume.nameKo ?? perfume.data?.nameKo,
  )
  const gender = readGenderFilter(perfume.data?.gender ?? null)
  const sub = [
    title !== review.perfume.name ? review.perfume.name : null,
    gender ? t(`overview.gender.${gender}`) : null,
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' · ')

  const removal = useMutation({
    mutationFn: () => deleteReview(review.reviewId),
    onSuccess: () => {
      setDeleteOpen(false)
      queryClient.removeQueries({
        queryKey: reviewKeys.detail(review.reviewId),
      })
      void queryClient.invalidateQueries({
        queryKey: perfumeKeys.detail(review.perfume.perfumeId),
      })

      onDeleted()
    },
  })

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
          ← {t('reviewDetail.backToBoard')}
        </LinkButton>

        <h1 className="text-ink text-title font-serif font-semibold">
          {review.title}
        </h1>

        <div className="flex items-center gap-2.5">
          <Thumbnail
            src={review.profileImageUrl}
            className="size-7.5 shrink-0 rounded-full"
          />
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
                  {t('reviewDetail.edit')}
                </LinkButton>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                >
                  {t('reviewDetail.delete')}
                </Button>
              </>
            )}

            <button
              type="button"
              aria-pressed={review.liked}
              aria-label={t('reviewDetail.likeLabel', {
                count: review.likeCount,
              })}
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
              // 서버의 계절 이름은 한국어뿐이라 코드로 풉니다
              <Badge key={season.seasonId} tone="outline">
                {t(`season.${season.code}`)}
              </Badge>
            ))}
          </div>
        )}

        <Link
          to={toPerfumeDetail(review.perfume.perfumeId)}
          state={perfumeViewState('COMMUNITY')}
          className={cn(
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
            <p className="text-ink text-body font-medium">{title}</p>
            {sub && <p className="text-ink-muted text-caption">{sub}</p>}
          </div>

          <span className="text-ink-muted text-caption ml-auto shrink-0">
            {t('reviewDetail.toPerfume')}
          </span>
        </Link>

        <hr className="border-line" />

        <p className="text-ink-muted text-caption">
          {t('reviewDetail.stats', {
            likes: review.likeCount,
            views: review.viewCount,
          })}
        </p>

        {removal.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(removal.error, t('reviewDetail.deleteFailed'))}
          </p>
        )}

        {likeToggle.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {t('reviewDetail.likeFailed')}
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
        description={t('reviewDetail.likeLoginDescription')}
      />
    </article>
  )
}
