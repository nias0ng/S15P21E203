import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import {
  CommentSection,
  commentsQuery,
  communityKeys,
  createComment,
  deleteComment,
  deletePost,
  likePost,
  POST_CATEGORIES,
  postDetailQuery,
  unlikePost,
  updateComment,
} from '@/features/community'
import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import {
  ROUTES,
  toPerfumeDetail,
  toPostDetail,
  toPostEdit,
} from '@/shared/config/routes'
import { useLikeToggle } from '@/shared/hooks/useLikeToggle'
import { useToast } from '@/shared/hooks/useToast'
import { authorName } from '@/shared/lib/authorName'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { parseId } from '@/shared/lib/parseId'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PageFallback } from '@/shared/ui/PageFallback'
import { PAPER_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { Toast } from '@/shared/ui/Toast'

const COMMENT_PAGE_SIZE = 20

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const parsedId = parseId(postId)
  const enabled = parsedId !== null
  const numericId = parsedId ?? Number.NaN

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast, toastProps } = useToast()

  const isLoggedIn = useIsLoggedIn()

  const [commentPage, setCommentPage] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  const post = useQuery({ ...postDetailQuery(numericId), enabled })
  const comments = useQuery({
    ...commentsQuery(numericId, { page: commentPage, size: COMMENT_PAGE_SIZE }),
    enabled,
  })

  const refreshComments = () =>
    void queryClient.invalidateQueries({ queryKey: communityKeys.all })

  const addComment = useMutation({
    mutationFn: (content: string) => createComment(numericId, content),
    onSuccess: refreshComments,
    onError: () => showToast('댓글을 남기지 못했습니다'),
  })

  const editComment = useMutation({
    mutationFn: ({
      commentId,
      content,
    }: {
      commentId: number
      content: string
    }) => updateComment(commentId, content),
    onSuccess: refreshComments,
    onError: () => showToast('댓글을 수정하지 못했습니다'),
  })

  const removeComment = useMutation({
    mutationFn: (commentId: number) => deleteComment(commentId),
    onSuccess: refreshComments,
    onError: () => showToast('댓글을 삭제하지 못했습니다'),
  })

  const removePost = useMutation({
    mutationFn: () => deletePost(numericId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
      navigate(ROUTES.COMMUNITY_FREE, { replace: true })
    },
    onError: () => {
      setDeleteOpen(false)
      showToast('게시글을 삭제하지 못했습니다')
    },
  })

  const likeToggle = useLikeToggle({
    like: likePost,
    unlike: unlikePost,
    onToggled: (result) => {
      queryClient.setQueryData(
        communityKeys.postDetail(numericId),
        (old: typeof post.data) =>
          old === undefined
            ? old
            : { ...old, liked: result.liked, likeCount: result.likeCount },
      )
    },
  })

  if (enabled && post.isPending) return <PageFallback />
  if (post.isError || !post.data) {
    return (
      <EmptyState
        title="게시글 상세 정보를 불러오지 못했습니다"
        description="다시 시도해주세요."
        onRetry={enabled ? () => post.refetch() : undefined}
      />
    )
  }

  const data = post.data

  return (
    <div className="space-y-6.25">
      <LinkButton to={ROUTES.COMMUNITY_FREE} variant="outline" size="sm">
        ← 자유 게시판
      </LinkButton>

      <article className="space-y-3.75">
        <header className="space-y-2.5">
          <Badge tone="neutral">
            {
              POST_CATEGORIES.find((item) => item.value === data.category)
                ?.label
            }
          </Badge>
          <h1 className="text-ink text-display font-serif font-bold">
            {data.title}
          </h1>

          <div className="text-caption flex items-center gap-2.5">
            <Thumbnail
              src={data.profileImageUrl}
              className="size-6.25 shrink-0 rounded-full"
            />
            <span className="text-ink">{authorName(data.nickname)}</span>
            <span className="text-ink-muted">
              · {formatRelativeTime(data.createdAt)} · 조회 {data.viewCount}
            </span>

            <span className="ml-auto flex items-center gap-2.5">
              {data.mine && (
                <>
                  <LinkButton
                    to={toPostEdit(numericId)}
                    variant="outline"
                    size="sm"
                  >
                    수정
                  </LinkButton>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                  >
                    삭제
                  </Button>
                </>
              )}

              <button
                type="button"
                aria-pressed={data.liked}
                aria-label={`좋아요 ${data.likeCount}`}
                disabled={likeToggle.isPending}
                onClick={() =>
                  likeToggle.toggle({ id: numericId, liked: data.liked })
                }
                className={cn(
                  'group rounded-card text-caption text-ink-muted flex items-center gap-1.25',
                  'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'text-heading leading-none transition-colors duration-120 ease-out',
                    data.liked ? 'text-like' : 'group-hover:text-like',
                  )}
                >
                  {data.liked ? '♥' : '♡'}
                </span>
                <span aria-hidden>{data.likeCount}</span>
              </button>
            </span>
          </div>
        </header>

        <div className={cn(PAPER_PANEL, 'space-y-6.25')}>
          <p className="text-ink text-heading leading-relaxed whitespace-pre-wrap">
            {data.content}
          </p>

          {data.imageUrls.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-ink-muted text-caption font-medium">
                첨부 이미지
              </h2>
              <ul className="flex flex-wrap gap-2.5">
                {data.imageUrls.map((url) => (
                  <li key={url}>
                    <Thumbnail src={url} className="h-32.5" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.collectionTitle && (
            <section className="space-y-2.5">
              <h2 className="text-ink-muted text-caption font-medium">
                첨부 컬렉션
              </h2>
              <p className="border-line-soft bg-surface-sunken text-ink text-body rounded-card inline-flex w-fit max-w-full border px-2.5 py-2.5">
                {data.collectionTitle}
              </p>
            </section>
          )}

          {data.relatedPerfumes.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-ink-muted text-caption font-medium">
                연결된 향수
              </h2>
              <ul className="space-y-2.5">
                {data.relatedPerfumes.map((perfume) => (
                  <li key={perfume.perfumeId}>
                    <Link
                      to={toPerfumeDetail(perfume.perfumeId)}
                      state={perfumeViewState('COMMUNITY')}
                      className={cn(
                        'border-line-soft bg-surface-sunken rounded-card hover:border-white',
                        'inline-flex w-fit max-w-full items-baseline gap-2.5 border px-2.5 py-2.5',
                        'transition-colors duration-120 ease-out',
                        // NOTE: 포커스 링을 일부러 안 답니다. 글쇠로 왔을 때 이 태그가 잡혔는지 보이지 않습니다
                        'outline-none',
                      )}
                    >
                      <span className="text-ink text-body font-medium">
                        {perfume.name}
                      </span>
                      {perfume.brand && (
                        <span className="text-ink-muted text-caption">
                          {perfume.brand}
                        </span>
                      )}
                      <span className="text-ink-muted text-caption ml-auto">
                        향수 상세 →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {likeToggle.error !== null && (
          <p className="text-danger text-caption" role="alert">
            좋아요를 누르지 못했습니다. 잠시 후 다시 시도해주세요.
          </p>
        )}
      </article>

      <CommentSection
        comments={comments.data?.comments ?? []}
        totalElements={data.commentCount}
        page={commentPage}
        size={COMMENT_PAGE_SIZE}
        onPageChange={setCommentPage}
        isPending={comments.isPending}
        onCreate={(content) => {
          if (!isLoggedIn) {
            setLoginOpen(true)
            return
          }
          addComment.mutate(content)
        }}
        onUpdate={(commentId, content) =>
          editComment.mutate({ commentId, content })
        }
        onDelete={(commentId) => removeComment.mutate(commentId)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`'${data.title}' 게시글을 삭제할까요?`}
        onConfirm={() => removePost.mutate()}
      />

      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={toPostDetail(numericId)}
        description="댓글은 로그인한 뒤에 쓸 수 있습니다."
      />

      <LoginRequiredDialog
        open={likeToggle.loginRequired}
        onClose={likeToggle.closeLoginRequired}
        redirectTo={toPostDetail(numericId)}
        description="좋아요는 로그인한 뒤에 누를 수 있습니다. 글은 로그인 없이도 읽을 수 있습니다."
      />

      <Toast {...toastProps} />
    </div>
  )
}
