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
  POST_CATEGORIES,
  postDetailQuery,
  updateComment,
} from '@/features/community'
import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import {
  ROUTES,
  toPerfumeDetail,
  toPostDetail,
  toPostEdit,
} from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { Toast } from '@/shared/ui/Toast'

/** 백엔드 기본값과 같습니다 */
const COMMENT_PAGE_SIZE = 20

/**
 * 게시글 상세 + 댓글 (와이어프레임 A23 — CMT-02 · 07 · 08 · 09 · 10 · 11)
 *
 * **자유 게시판 전용입니다.** 후기는 백엔드에서 다른 자원이라
 * `/reviews/:reviewId` 에서 보여줍니다. 후기에는 댓글을 달지 않습니다(A22a).
 *
 * 여는 것이 곧 조회라 조회수가 하나 오릅니다 — 창 포커스 · 재연결 재요청은
 * queries.ts 에서 꺼 두었습니다.
 *
 * 와이어프레임 주석: "연결 향수와 첨부 이미지가 없으면 이 영역들을 표시하지 않는다".
 * 자유 글은 향수를 걸지 않아도 되므로 값이 있을 때만 그립니다.
 *
 * 폭은 라우트의 text(800px)입니다. 이 화면은 목록이 아니라 **읽는 화면**이라 본문이
 * wide(1440px)를 꽉 채우면 한 줄이 100자를 넘어가고, 줄을 바꿀 때마다 눈이 왼쪽 끝을
 * 다시 찾아야 합니다.
 */
export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const numericId = Number(postId)
  const enabled = Number.isFinite(numericId)

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

  /*
    댓글이 늘거나 줄면 **글 상세도 함께 낡습니다** — 댓글 수(`commentCount`)를
    거기서 읽기 때문입니다. 목록의 댓글 수도 같은 값이라 커뮤니티 키를 통째로 비웁니다.

    낙관적으로 그리지 않습니다. 서버가 붙이는 번호 · 작성 시각 · 닉네임을 화면이
    지어낼 수 없어서, 미리 그린 줄과 도착한 줄이 다르게 보입니다.
  */
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

  /** 글 삭제 (CMT-07). 지운 글에 머물 수 없어 게시판으로 돌려보냅니다 */
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

  if (post.isPending) return <PageFallback />
  if (post.isError || !post.data) {
    return (
      <EmptyState
        title="게시글 상세 정보를 불러오지 못했습니다"
        description="다시 시도해주세요."
        action={
          <Button variant="outline" onClick={() => post.refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

  const data = post.data

  return (
    // 폭은 라우트의 TEXT(800) 가 정합니다 — 글 읽는 화면 공통 폭
    <div className="space-y-7.5">
      <LinkButton to={ROUTES.COMMUNITY_FREE} variant="outline" size="sm">
        ← 자유 게시판
      </LinkButton>

      <article className="space-y-6.25">
        {/* 제목 묶음. 아래 선으로 본문과 나눕니다 — hr 을 따로 두면 간격이 두 번 생깁니다 */}
        <header className="border-line space-y-2.5 border-b pb-6.25">
          {/* 자유 글은 분류가 필수라 늘 있습니다 */}
          <Badge tone="neutral">
            {
              POST_CATEGORIES.find((item) => item.value === data.category)
                ?.label
            }
          </Badge>
          {/* 이 화면의 대표 제목이라 display 입니다 (UI 명세 1.1) */}
          <h1 className="text-ink text-display font-serif font-bold">
            {data.title}
          </h1>

          <div className="text-caption flex items-center gap-2.5">
            {/* 탈퇴한 회원의 글은 글만 남고 작성자가 지워집니다 */}
            <span className="text-ink">{data.nickname ?? '탈퇴한 회원'}</span>
            <span className="text-ink-muted">
              · {formatRelativeTime(data.createdAt)} · 조회 {data.viewCount}
            </span>

            {data.mine && (
              <span className="ml-auto flex gap-2.5">
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
              </span>
            )}
          </div>
        </header>

        <p className="text-ink text-body whitespace-pre-wrap">{data.content}</p>

        {/* 첨부 이미지가 없으면 영역 자체를 그리지 않습니다 */}
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

        {/* 컬렉션 공유 글에만 붙습니다 */}
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

        {/* 연결 향수가 없으면 영역 자체를 그리지 않습니다 */}
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
                      'border-line-soft bg-surface-sunken hover:border-accent rounded-card',
                      'inline-flex w-fit max-w-full items-baseline gap-2.5 border px-2.5 py-2.5',
                      'transition-colors duration-120 ease-out',
                      'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                    )}
                  >
                    <span className="text-ink text-body font-medium">
                      {perfume.name}
                    </span>
                    {/* 브랜드가 없는 향수가 있습니다 */}
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
      </article>

      <hr className="border-line" />

      <CommentSection
        comments={comments.data?.comments ?? []}
        // 전체 개수는 글 상세가 정본입니다 — 쪽을 넘기는 동안도 값이 흔들리지 않습니다
        totalElements={data.commentCount}
        page={commentPage}
        size={COMMENT_PAGE_SIZE}
        onPageChange={setCommentPage}
        isPending={comments.isPending}
        /*
          비로그인이면 보내 보고 실패하는 대신 먼저 안내합니다. 401 이 나면 인터셉터가
          재발급을 시도하다 세션을 정리해, 사용자에게는 "왜 안 되지" 만 남습니다.
        */
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
        destructive
      />

      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={toPostDetail(numericId)}
        description="댓글은 로그인한 뒤에 쓸 수 있습니다."
      />

      <Toast {...toastProps} />
    </div>
  )
}
