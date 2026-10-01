import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { authorName } from '@/shared/lib/authorName'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Pagination } from '@/shared/ui/Pagination'
import { PAPER_PANEL } from '@/shared/ui/panel'
import { Textarea } from '@/shared/ui/Textarea'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { Comment } from '../types'

type Props = {
  comments: Comment[]
  totalElements: number
  page: number
  size: number
  onPageChange: (page: number) => void
  isPending?: boolean
  onCreate: (content: string) => void
  onUpdate: (commentId: number, content: string) => void
  onDelete: (commentId: number) => void
}

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
  const { t } = useTranslation('community')
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  return (
    <section className={cn(PAPER_PANEL, 'space-y-3.75')}>
      <h2 className="text-ink text-title font-serif font-bold">
        {t('comments.heading', { count: totalElements })}
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
        <div className="flex-1">
          <Textarea
            label={t('comments.inputLabel')}
            hideLabel
            placeholder={t('comments.placeholder')}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={draft.trim().length === 0}>
          {t('comments.submit')}
        </Button>
      </form>

      {isPending && (
        <p className="text-ink-muted text-caption">{t('comments.loading')}</p>
      )}

      <ul className="divide-line-soft border-line-soft divide-y border-t">
        {comments.map((comment) => (
          <li key={comment.commentId} className="space-y-2.5 py-3.75">
            <div className="text-caption flex items-center gap-2.5">
              <Thumbnail
                src={comment.profileImageUrl}
                className="size-6.25 shrink-0 rounded-full"
              />
              <span className="text-ink">{authorName(comment.nickname)}</span>
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
                      setEditDraft(comment.content)
                    }}
                  >
                    {t('comments.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(comment.commentId)}
                  >
                    {t('comments.delete')}
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
                  label={t('comments.editLabel')}
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
                    {t('comments.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={editDraft.trim().length === 0}
                  >
                    {t('comments.save')}
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
        label={t('comments.pagination')}
        page={page}
        size={size}
        totalElements={totalElements}
        onPageChange={onPageChange}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('comments.deleteConfirm')}
        onConfirm={() => {
          if (deleteTarget !== null) onDelete(deleteTarget)
          setDeleteTarget(null)
        }}
      />
    </section>
  )
}
