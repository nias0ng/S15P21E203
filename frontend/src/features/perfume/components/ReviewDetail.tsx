import { useState } from 'react'

import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { Review } from '../types'

type Props = {
  review: Review
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
 * 권한이 지켜지지 않으니 백엔드에서도 작성자를 확인해야 합니다.
 */
export function ReviewDetail({ review, backTo, editTo }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <article className="border-line bg-surface-card border">
      <div className="space-y-4 p-6">
        <LinkButton to={backTo} variant="outline" size="sm">
          ← 향수 상세
        </LinkButton>

        <div className="flex items-center gap-3">
          {/* TODO: 프로필 이미지 연동 */}
          <Thumbnail className="size-8 shrink-0 rounded-full" />
          <span className="text-ink text-xs">{review.nickname}</span>
          <span className="text-ink-muted text-[10.5px]">
            · {formatRelativeTime(review.createdAt)}
          </span>

          {review.mine && (
            <span className="ml-auto flex gap-1.5">
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

        <hr className="border-line" />

        <p className="text-ink-muted text-[10.5px]">
          본인이 작성한 후기에만 수정 · 삭제가 보입니다.
        </p>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          // TODO: DTL-06 후기 삭제 API 연결 후 향수 상세로 이동
          setDeleteOpen(false)
        }}
      />
    </article>
  )
}
