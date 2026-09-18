import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { isApiError } from '@/shared/api/http'
import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail, toReviewDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { useIsLoggedIn } from '@/shared/store/authStore'
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
   * 삭제가 끝난 뒤 화면을 옮기는 일은 부르는 쪽이 합니다.
   *
   * 여기서 직접 하지 않는 이유: 삭제하면 커뮤니티 게시판 목록도 낡는데,
   * `features/perfume` 은 `features/community` 를 import 할 수 없습니다. 키를
   * 문자열로 적어 넘어갈 수는 있지만 그건 린트만 피하고 경계는 넘는 것입니다.
   * 두 도메인을 다 아는 곳은 화면(`pages/`)이라 거기서 정리합니다.
   */
  onDeleted?: () => void
}

/**
 * 후기 상세 (와이어프레임 A12 — DTL-03 · DTL-05 · DTL-06)
 *
 * 와이어프레임 주석: "본인이 작성한 후기에만 수정 · 삭제가 보인다".
 * 그래서 review.mine 일 때만 두 버튼을 그립니다. 화면에서 숨기는 것만으로는
 * 권한이 지켜지지 않으니 백엔드도 수정 · 삭제 때 작성자를 다시 확인합니다.
 *
 * **유리판 한 장입니다.** 이 화면으로 들어오는 두 길(향수 상세 A10 의 후기 목록 ·
 * 후기 게시판 A22a)이 둘 다 어두운 방이라, 여기도 같은 어둠입니다(라우트의
 * `handle.night`). 예전의 `bg-surface-card` 는 그 어둠에서 `--night-soft` 로
 * 뒤집혀 갈색 상자가 됐습니다.
 */
export function PerfumeReviewDetail({ review, editTo, onDeleted }: Props) {
  const queryClient = useQueryClient()
  const isLoggedIn = useIsLoggedIn()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  /*
    향수 칸에 채울 것 — 사진 · 한국어 이름 · 성별.

    **후기 응답에는 없습니다.** `review.perfume` 은 번호 · 영문 이름 · 브랜드 셋뿐이라
    (types.ts 의 `ReviewDetail`) 향수 상세를 따로 부릅니다. 향수 상세 화면과 같은
    쿼리 키라 방금 그 화면에서 넘어왔으면 캐시에 이미 있습니다.

    도착 전에도 칸은 그립니다 — 이름과 브랜드는 후기 응답에 있어서, 사진과 아랫줄만
    빈 채로 자리를 지키면 값이 도착할 때 칸이 튀지 않습니다.
  */
  const perfume = useQuery(perfumeDetailQuery(review.perfume.perfumeId))
  const brandName = perfume.data?.brand?.name ?? review.perfume.brand
  /*
    한국어 이름과 성별을 가운뎃점으로 잇습니다. **배열로 모아 잇는** 이유는 둘 다
    없을 수 있어서입니다 — 문자열을 직접 붙이면 한쪽이 빠졌을 때 가운뎃점만 남거나
    빈 줄이 자리를 차지합니다. 개요(A10)의 영문 줄과 같은 방식입니다.
  */
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
   * 좋아요 토글 (CMT-05). 후기 게시판(A22a)과 같은 방식입니다.
   *
   * 응답에 `liked` 와 `likeCount` 가 함께 오므로 화면이 숫자를 직접 더하고 빼지
   * 않습니다 — 그 사이 다른 사람이 누른 것도 같이 반영됩니다. 그래서 다시 부르지
   * 않고 **응답 값을 이 후기에만 덮어씁니다.** 다시 부르면 조회수가 한 번 더
   * 오릅니다 — 여는 것이 곧 조회라서입니다.
   *
   * 서버가 멱등이라(이미 누른 것에 또 눌러도 같은 결과) 따닥 누름을 막지 않습니다.
   *
   * 게시판 목록의 숫자는 여기서 건드리지 않습니다. `features/community` 를 import
   * 할 수 없기도 하고, 목록 쿼리에 staleTime 이 없어 뒤로 가면 어차피 다시 불립니다.
   */
  const toggleLike = useMutation({
    mutationFn: () =>
      review.liked
        ? unlikeReview(review.reviewId)
        : likeReview(review.reviewId),
    onSuccess: (result) => {
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
        {/*
          **읽던 목록으로 돌아갑니다.** 예전에는 이 자리가 향수 상세로 갔는데,
          [뒤로] 자리에 "오지 않은 곳" 이 적혀 있던 셈입니다 — 후기를 읽다 뒤로
          가려는 사람은 후기 목록으로 가려는 것이지 향수로 건너가려는 것이 아닙니다.
          자유 게시판 글 상세(A23)의 [← 자유 게시판] 과 같은 자리 · 같은 말입니다.

          향수로 건너가는 길은 아래 향수 칸이 맡습니다.
        */}
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

          {/*
            줄 오른쪽 끝. 하트는 **늘 맨 끝**이고 수정 · 삭제는 그 앞에 섭니다 —
            내 후기냐 아니냐에 따라 하트가 좌우로 움직이면, 게시판에서 후기를 여러 개
            열어 볼 때 같은 자리를 매번 다시 겨냥하게 됩니다.
          */}
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
              좋아요. **숫자는 안 답니다** — 아래 줄이 이미 적고 있어서, 옆에 또
              적으면 같은 수가 한 화면에 두 번 나옵니다. 낭독기에는 `aria-label` 로
              수를 알리고 눌린 상태는 `aria-pressed` 로 전합니다(색만으로는 못 전합니다).

              비로그인은 401 이라, 보내 보는 대신 먼저 안내합니다 — 401 이 나면
              인터셉터가 재발급을 시도하다 세션을 정리해 "왜 안 되지" 만 남습니다.
            */}
            <button
              type="button"
              aria-pressed={review.liked}
              aria-label={`좋아요 ${review.likeCount}`}
              disabled={toggleLike.isPending}
              onClick={() => {
                if (!isLoggedIn) {
                  setLoginOpen(true)
                  return
                }
                toggleLike.mutate()
              }}
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

        {/*
          이 후기가 말하는 향수.

          **누르면 향수 상세(A10)로 갑니다.** 머리가 아니라 글 아래인 이유: 후기를
          열었을 때 먼저 읽을 것은 글이고 "무엇에 대한 글이었나" 는 다 읽고 나서
          확인하는 순서라서입니다. 위 [뒤로] 가 목록으로 가게 되면서, 향수로
          건너가는 길은 이 칸 하나가 됐습니다.

          들어온 길(`perfumeViewState`)을 실어 보냅니다 — 향수 상세가 조회 기록에
          "커뮤니티에서 왔다" 를 남깁니다.

          바탕을 칠하지 않고 테두리만 두릅니다 — 유리판 위에서 한 단 어둡게 깔면
          판에 파인 자리가 되는데, 이 칸은 파묻힌 것이 아니라 얹힌 것입니다.

          사진은 `bare` 입니다. 향수병은 배경이 투명한 PNG 라 상자를 그리면 투명한
          영역이 네모로 드러나 병이 상자에 담긴 것처럼 보입니다. 사진이 없을 때만
          자리표시자 상자가 나옵니다.
        */}
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

          {/*
            누를 수 있다는 표시. 칸 전체가 링크라 테두리 색만으로는 "누르는 곳" 인지
            잘 안 읽힙니다 — 글 상세(A23)의 연결 향수 줄과 같은 말 · 같은 자리입니다.
          */}
          <span className="text-ink-muted text-caption ml-auto shrink-0">
            향수 상세 →
          </span>
        </Link>

        <hr className="border-line" />

        {/*
          조회수는 이번 조회를 포함한 수입니다. 좋아요 수도 여기서는 읽기만 합니다 —
          누르는 것은 위 줄의 하트가 맡습니다.
        */}
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

        {toggleLike.error !== null && (
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
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={toReviewDetail(review.reviewId)}
        description="좋아요는 로그인한 뒤에 누를 수 있습니다. 후기는 로그인 없이도 읽을 수 있습니다."
      />
    </article>
  )
}
