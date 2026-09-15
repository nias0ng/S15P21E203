import { useState } from 'react'

import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { ReviewDetail } from '../types'

type Props = {
  review: ReviewDetail
  /** 이 후기가 달린 향수 상세로 돌아갈 경로 */
  backTo: string
  /** 후기 수정 화면 경로 (A24a 가 후기 대상을 걸고 열립니다) */
  editTo: string
}

/**
 * 후기 상세 (와이어프레임 A12 — DTL-03 · DTL-05 · DTL-06)
 *
 * 와이어프레임 주석: "본인이 작성한 후기에만 수정 · 삭제가 보인다".
 * 그래서 review.mine 일 때만 두 버튼을 그립니다. 화면에서 숨기는 것만으로는
 * 권한이 지켜지지 않으니 백엔드도 수정 · 삭제 때 작성자를 다시 확인합니다.
 */
export function PerfumeReviewDetail({ review, backTo, editTo }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <article className="border-line bg-surface-card border">
      <div className="space-y-3.75 p-6.25">
        <LinkButton to={backTo} variant="outline" size="sm">
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
                onClick={() => setDeleteOpen(true)}
              >
                삭제
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
          조회수는 이번 조회를 포함한 수입니다. 좋아요 누르기는 로그인이 필요해
          아직 붙이지 않았습니다 — 지금은 숫자만 읽습니다.
        */}
        <p className="text-ink-muted text-[10.5px]">
          좋아요 {review.likeCount} · 조회 {review.viewCount}
        </p>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          // TODO: DTL-06 후기 삭제 API 연결 후 향수 상세로 이동 (로그인 필요)
          setDeleteOpen(false)
        }}
      />
    </article>
  )
}
