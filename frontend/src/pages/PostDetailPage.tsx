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

/** 백엔드 기본값과 같습니다 */
const COMMENT_PAGE_SIZE = 20

/**
 * 게시글 상세 + 댓글 (A23 — CMT-02 · 07 ~ 11)
 *
 * **자유 게시판 전용입니다.** 후기는 백엔드에서 다른 자원이라 `/reviews/:reviewId`
 * 에서 보여주고, 후기에는 댓글을 달지 않습니다(A22a).
 *
 * 여는 것이 곧 조회라 조회수가 하나 오릅니다 — 창 포커스 · 재연결 재요청은
 * queries.ts 에서 꺼 두었습니다. 연결 향수 · 첨부는 값이 있을 때만 그립니다.
 *
 * 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md */
export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const parsedId = parseId(postId)
  const enabled = parsedId !== null
  /* 번호가 될 수 없는 주소면 부르지 않고, 글이 없으니 아래 쓰기 요청도 나가지 않습니다 */
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

  /**
   * 좋아요 토글 (CMT-05). 비로그인 안내 · 누르기/취소 고르기는 `useLikeToggle` 이
   * 맡고, 여기서는 캐시만 고칩니다 — 다시 부르지 않고 **응답 값을 이 글에만
   * 덮어씁니다.** 다시 부르면 조회수가 한 번 더 오릅니다(여는 것이 곧 조회라서).
   *
   * 게시판 목록은 비우지 않습니다. `staleTime` 이 없어 되돌아가면 어차피 다시
   * 받는데, 여기서 `communityKeys.all` 을 비우면 방금 덮어쓴 이 글까지 딸려가
   * 조회수가 또 오릅니다.
   */
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

  // 꺼 둔 쿼리는 늘 pending 이라 `enabled` 로 가르지 않으면 번호가 틀린 주소에서 스피너가 끝나지 않습니다
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
    // 폭은 라우트의 TEXT_NIGHT(800) 가 정합니다 — 글 읽는 화면 공통 폭
    <div className="space-y-6.25">
      <LinkButton to={ROUTES.COMMUNITY_FREE} variant="outline" size="sm">
        ← 자유 게시판
      </LinkButton>

      <article className="space-y-3.75">
        {/*
          제목 묶음. 어둠에 바로 놓입니다 — 아래 본문 판의 위 테두리가 이미
          "여기서부터 글" 을 긋고 있어, 밑줄(border-b)까지 두면 경계가 두 겹입니다.
        */}
        <header className="space-y-2.5">
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
            {/* 크기는 아래 댓글 아바타와 맞춥니다 — 한 화면에서 작성자 아바타가 두 크기로 서지 않게 합니다 */}
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

              {/*
                비로그인은 401 이라 보내 보지 않고 먼저 안내합니다 — 401 이 나면
                인터셉터가 재발급을 시도하다 세션을 정리해 버립니다.
              */}
              <button
                type="button"
                aria-pressed={data.liked}
                aria-label={`좋아요 ${data.likeCount}`}
                disabled={likeToggle.isPending}
                onClick={() =>
                  likeToggle.toggle({ id: numericId, liked: data.liked })
                }
                className={cn(
                  'rounded-card text-caption flex items-center gap-1.25',
                  'transition-colors duration-120 ease-out',
                  'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                  data.liked
                    ? 'text-danger'
                    : 'text-ink-muted hover:text-danger',
                )}
              >
                <span aria-hidden className="text-heading leading-none">
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
                        // 올렸을 때 흰 테두리 — 청동은 흰 판 위에서 황갈색으로 탁합니다
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
        </div>

        {likeToggle.error !== null && (
          <p className="text-danger text-caption" role="alert">
            좋아요를 누르지 못했습니다. 잠시 후 다시 시도해주세요.
          </p>
        )}
      </article>

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
      />

      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={toPostDetail(numericId)}
        description="댓글은 로그인한 뒤에 쓸 수 있습니다."
      />

      {/* 댓글용과 따로 둡니다 — 무엇을 하려다 막혔는지 문구가 달라야 합니다 */}
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
