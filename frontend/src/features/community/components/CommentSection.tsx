import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Textarea } from '@/shared/ui/Textarea'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { Comment } from '../types'

type Props = {
  comments: Comment[]
  /** 이 글의 전체 댓글 수. 보고 있는 쪽의 개수가 아닙니다 */
  totalElements: number
  /** 0부터 시작합니다 */
  page: number
  size: number
  onPageChange: (page: number) => void
  isPending?: boolean
  onCreate: (content: string) => void
  onUpdate: (commentId: number, content: string) => void
  onDelete: (commentId: number) => void
}

/**
 * 댓글 (와이어프레임 A23 — CMT-08 · 09 · 10 · 11)
 *
 * 수정은 그 자리에서 편집 상태로 바뀝니다. 본인 댓글에만 보이지만, 화면에서 숨기는
 * 것만으로는 권한이 지켜지지 않으니 백엔드에서도 작성자를 확인해야 합니다.
 */
export function CommentSection({
  comments,
  totalElements,
  page,
  size,
  onPageChange,
  isPending = false,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  /*
   * 댓글 묶음도 유리판에 올립니다.
   *
   * 예전에는 반대였습니다 — 밝은 화면에서는 종이 위에 흰 칸이 입력창 하나뿐이어야
   * "쓰는 자리" 가 한눈에 보였습니다. 어두운 방에서는 그 논리가 뒤집힙니다: 판이
   * 없으면 댓글이 어둠 위에 맨몸으로 떠서, 바로 위 본문 판과 층이 어긋납니다.
   * 입력칸은 판 위에서 **파인 자리**(검정 0.22)로 앉으므로 여전히 판과 구분됩니다
   * (styles/scent-display.css 의 `--color-surface-card`).
   */
  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75')}>
      <h2 className="text-ink text-title font-serif font-bold">
        댓글 {totalElements}
      </h2>

      <form
        className="flex items-start gap-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          const value = draft.trim()
          if (!value) return
          onCreate(value)
          setDraft('')
        }}
      >
        {/* Textarea 는 래퍼에 className 을 받지 않으므로 flex 배치는 여기서 합니다 */}
        <div className="flex-1">
          <Textarea
            label="댓글 내용"
            hideLabel
            placeholder="댓글을 입력하세요"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={draft.trim().length === 0}>
          등록
        </Button>
      </form>

      {/*
        상자로 감싸지 않고 줄로만 나눕니다. 댓글은 글 하나하나가 카드가 될 만큼
        길지 않고, 테두리를 두르면 본문보다 댓글 쪽이 더 무거워 보입니다.
        py-3.75 는 위아래 여백이고 가로 여백은 없습니다 — 본문과 왼쪽 선을 맞춥니다.
      */}
      {isPending && (
        <p className="text-ink-muted text-caption">댓글을 불러오는 중입니다.</p>
      )}

      <ul className="divide-line-soft border-line-soft divide-y border-t">
        {comments.map((comment) => (
          <li key={comment.commentId} className="space-y-2.5 py-3.75">
            <div className="text-caption flex items-center gap-2.5">
              <Thumbnail className="size-6.25 shrink-0 rounded-full" />
              {/* 탈퇴한 회원의 댓글은 글만 남고 작성자가 지워집니다 */}
              <span className="text-ink">
                {comment.nickname ?? '탈퇴한 회원'}
              </span>
              <span className="text-ink-muted">
                · {formatRelativeTime(comment.createdAt)}
              </span>

              {comment.mine && editingId !== comment.commentId && (
                <span className="ml-auto flex gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(comment.commentId)
                      // 작성한 댓글 내용이 그대로 들어옵니다
                      setEditDraft(comment.content)
                    }}
                  >
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(comment.commentId)}
                  >
                    삭제
                  </Button>
                </span>
              )}
            </div>

            {editingId === comment.commentId ? (
              <form
                className="space-y-2.5"
                onSubmit={(event) => {
                  event.preventDefault()
                  onUpdate(comment.commentId, editDraft.trim())
                  setEditingId(null)
                }}
              >
                <Textarea
                  label="댓글 수정"
                  hideLabel
                  rows={3}
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                />
                <div className="flex justify-end gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={editDraft.trim().length === 0}
                  >
                    저장
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-ink text-body whitespace-pre-wrap">
                {comment.content}
              </p>
            )}
          </li>
        ))}
      </ul>

      <Pagination
        label="댓글 페이지"
        page={page}
        size={size}
        totalElements={totalElements}
        onPageChange={onPageChange}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="댓글을 삭제할까요?"
        onConfirm={() => {
          if (deleteTarget !== null) onDelete(deleteTarget)
          setDeleteTarget(null)
        }}
      />
    </section>
  )
}
