import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { isApiError } from '@/shared/api/http'
import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { deleteReview } from '../api'
import { perfumeKeys, reviewKeys } from '../queries'
import type { ReviewDetail } from '../types'

type Props = {
  review: ReviewDetail
  /** 이 후기가 달린 향수 상세로 돌아갈 경로 */
  backTo: string
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
 */
export function PerfumeReviewDetail({
  review,
  backTo,
  editTo,
  onDeleted,
}: Props) {
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

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

  return (
    <article className="border-line bg-surface-card border">
      <div className="space-y-3.75 p-6.25">
        {/*
          후기를 읽다 향수로 건너가는 길입니다 — 들어온 길은 늘 커뮤니티입니다
          (후기 게시판 · 향수 상세의 후기 목록 어느 쪽에서 왔든 읽던 것은 후기입니다).
        */}
        <LinkButton
          to={backTo}
          state={perfumeViewState('COMMUNITY')}
          variant="outline"
          size="sm"
        >
          ← {review.perfume.name}
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

          {review.mine && (
            <span className="ml-auto flex gap-1.25">
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
            </span>
          )}
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

        <hr className="border-line" />

        {/*
          조회수는 이번 조회를 포함한 수입니다. **상세에서는 읽기 전용입니다** —
          좋아요를 누르는 것은 후기 게시판(A22a)에서만 합니다.
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
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => removal.mutate()}
      />
    </article>
  )
}
