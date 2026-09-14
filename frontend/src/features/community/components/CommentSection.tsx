import { useState } from 'react'

import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Textarea } from '@/shared/ui/Textarea'
import { Thumbnail } from '@/shared/ui/Thumbnail'

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
 * 수정은 그 자리에서 편집 상태로 바뀝니다. 본인 댓글에만 보이지만, 화면에서 숨기는
 * 것만으로는 권한이 지켜지지 않으니 백엔드에서도 작성자를 확인해야 합니다.
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

  /*
   * 댓글 묶음은 판에 올리지 않습니다 — 흰 칸이 입력창 하나뿐이어야 "쓰는 자리" 가
   * 한눈에 보입니다. 위쪽 게시글 본문은 반대로 판에 올립니다(읽는 덩어리는 경계 필요).
   */
  return (
    <section className="space-y-4">
      <h2 className="text-ink text-title font-serif font-bold">
        댓글 {comments.length}
      </h2>

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
        py-4 는 위아래 여백이고 가로 여백은 없습니다 — 본문과 왼쪽 선을 맞춥니다.
      */}
      <ul className="divide-line-soft border-line-soft divide-y border-t">
        {comments.map((comment) => (
          <li key={comment.commentId} className="space-y-2 py-4">
            <div className="text-caption flex items-center gap-2">
              <Thumbnail className="size-6 shrink-0 rounded-full" />
              <span className="text-ink">{comment.nickname}</span>
              <span className="text-ink-muted">
                · {formatRelativeTime(comment.createdAt)}
              </span>

              {comment.mine && editingId !== comment.commentId && (
                <span className="ml-auto flex gap-2">
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
                <Textarea
                  label="댓글 수정"
                  hideLabel
                  rows={3}
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                />
                <div className="flex justify-end gap-2">
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

      <p className="text-ink-muted text-caption">
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
