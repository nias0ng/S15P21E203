import { Link } from 'react-router'

import { toPerfumeDetail, toPostDetail } from '@/shared/config/routes'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'

import { POST_CATEGORIES, type PostSummary } from '../types'

type Props = {
  posts: PostSummary[]
  isPending?: boolean
  emptyAction?: React.ReactNode
}

/**
 * 게시글 목록 (와이어프레임 A22a · A22b 공용)
 *
 * 와이어프레임 주석:
 * - 점수 · 별점 없음 — 좋아요만. 카드마다 좋아요 · 댓글 · 조회 수를 함께 보여준다
 * - 후기는 향수 한 개에 반드시 붙는다 — 향수 블록이 없는 후기는 없다
 * - 자유 글에는 향수를 걸지 않아도 된다 — 걸면 후기와 같은 향수 블록이 붙는다
 *
 * 그래서 향수 블록은 값이 있을 때만 그리고, 두 게시판이 같은 컴포넌트를 씁니다.
 */
export function PostList({ posts, isPending = false, emptyAction }: Props) {
  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        title="이 게시판에 글이 없습니다"
        description="첫 글을 남겨보세요."
        action={emptyAction}
      />
    )
  }

  return (
    <ul className="border-line divide-line divide-y border">
      {posts.map((post) => (
        <li key={post.postId} className="p-4">
          <div className="flex items-center gap-2 text-[10.5px]">
            <span
              aria-hidden
              className="border-line bg-surface-sunken size-6 shrink-0 rounded-full border"
            />
            <span className="text-ink">{post.nickname}</span>
            <span className="text-ink-muted">
              · {formatRelativeTime(post.createdAt)}
            </span>
            {/* 자유 글에만 분류가 있습니다 */}
            {post.category && (
              <Badge tone="neutral">
                {
                  POST_CATEGORIES.find((item) => item.value === post.category)
                    ?.label
                }
              </Badge>
            )}
          </div>

          {/* 향수 블록 — 후기는 항상, 자유 글은 걸었을 때만 */}
          {post.perfume && (
            <Link
              to={toPerfumeDetail(post.perfume.perfumeId)}
              className="border-line hover:bg-line-soft mt-2 flex items-center gap-2 border px-2.5 py-1.5"
            >
              <span className="text-ink text-[11px] font-bold">
                {post.perfume.name}
              </span>
              <span className="text-ink-muted text-[10.5px]">
                {post.perfume.brand}
              </span>
            </Link>
          )}

          <Link
            to={toPostDetail(post.postId)}
            className="text-ink mt-2 block text-sm font-bold hover:underline"
          >
            {post.title}
          </Link>

          {/* 점수나 별점은 없습니다. 좋아요만 있습니다. */}
          <div className="text-ink-muted mt-2 flex items-center gap-4 text-[10.5px]">
            <span>
              <span aria-hidden>{post.liked ? '♥' : '♡'}</span> 좋아요{' '}
              {post.likeCount}
            </span>
            <span>댓글 {post.commentCount}</span>
            <span>조회 {post.viewCount}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
