import { useState } from 'react'

import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'

import type { Comment } from '../types'

type Props = {
  comments: Comment[]
  onCreate: (content: string) => void
  onUpdate: (commentId: number, content: string) => void
  onDelete: (commentId: number) => void
}

/**
 * 댓글 (와이어프레임 A23 — CMT-08 · 09 · 10 · 11)
 *
 * 와이어프레임 주석: "본인 댓글에만 수정 · 삭제가 보인다 · 스크롤하면 이어서 로드".
 * 수정은 별도 화면이 아니라 그 자리에서 편집 상태로 바뀌고, 작성한 내용이
 * 그대로 들어온 채 시작합니다.
 *
 * 화면에서 숨기는 것만으로는 권한이 지켜지지 않으니 백엔드에서도 작성자를
 * 확인해야 합니다.
 */
export function CommentSection({
  comments,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  return (
    <section className="space-y-3">
      <h2 className="text-ink text-sm font-bold">댓글 {comments.length}</h2>

      <form
        className="flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const value = draft.trim()
          if (!value) return
          onCreate(value)
          setDraft('')
        }}
      >
        <label className="flex-1">
          <span className="sr-only">댓글 내용</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="댓글을 입력하세요"
            rows={2}
            className="border-line text-ink placeholder:text-ink-muted focus-visible:ring-accent w-full border p-2.5 text-xs outline-none focus-visible:ring-2"
          />
        </label>
        <Button type="submit" disabled={draft.trim().length === 0}>
          등록
        </Button>
      </form>

      <ul className="border-line divide-line divide-y border">
        {comments.map((comment) => (
          <li key={comment.commentId} className="space-y-2 p-3">
            <div className="flex items-center gap-2 text-[10.5px]">
              <span
                aria-hidden
                className="border-line bg-surface-sunken size-6 shrink-0 rounded-full border"
              />
              <span className="text-ink">{comment.nickname}</span>
              <span className="text-ink-muted">
                · {formatRelativeTime(comment.createdAt)}
              </span>

              {comment.mine && editingId !== comment.commentId && (
                <span className="ml-auto flex gap-1.5">
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
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  onUpdate(comment.commentId, editDraft.trim())
                  setEditingId(null)
                }}
              >
                <label>
                  <span className="sr-only">댓글 수정</span>
                  <textarea
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    rows={3}
                    className="border-line text-ink focus-visible:ring-accent w-full border p-2.5 text-xs outline-none focus-visible:ring-2"
                  />
                </label>
                <div className="flex justify-end gap-1.5">
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
              <p className="text-ink text-xs leading-relaxed whitespace-pre-wrap">
                {comment.content}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="text-ink-muted text-[10.5px]">
        본인 댓글에만 수정 · 삭제가 보입니다.
      </p>

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
