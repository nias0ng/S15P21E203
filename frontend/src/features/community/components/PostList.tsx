import { Link } from 'react-router'

import { toPerfumeDetail, toPostDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

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
 *
 * ── 읽는 순서를 바꿨습니다 ────────────────────────────────
 * 예전에는 글쓴이 → 향수 → **제목** → 숫자 순이라 제목이 가운데 묻혀 있었습니다.
 * 게시판에서 훑는 것은 제목이므로 제목을 맨 위로 올리고, 글쓴이와 시간은 그 아래
 * 한 줄로 내렸습니다. 향수 블록은 제목 다음입니다 — 후기에서는 "무엇에 대한 글인가"
 * 가 제목만큼 중요합니다.
 *
 * 테두리로 칸을 나누던 목록을 카드로 바꿨습니다. 줄로만 나누면 어디까지가 한 글인지
 * 세로로 훑을 때 잘 안 보입니다.
 */
export function PostList({ posts, isPending = false, emptyAction }: Props) {
  if (isPending) {
    return (
      <div className="space-y-3.75">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="rounded-card h-32.5" />
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
    <ul className="space-y-3.75">
      {posts.map((post) => (
        <li key={post.postId}>
          {/*
            카드 전체가 아니라 제목만 링크입니다. 카드를 통째로 링크로 감싸면 안에
            있는 향수 블록 링크가 링크 안의 링크가 되어 낭독기와 브라우저가 둘 다
            헷갈립니다. 대신 카드에 group 을 걸어 어디에 마우스를 올리든 제목에
            밑줄이 들어옵니다.
          */}
          <Card interactive className="group space-y-2.5">
            <div className="space-y-2.5">
              <Link
                to={toPostDetail(post.postId)}
                className={cn(
                  'text-ink text-heading block font-serif font-bold',
                  'underline-offset-4 group-hover:underline',
                  'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2',
                )}
              >
                {post.title}
              </Link>

              <div className="text-caption flex flex-wrap items-center gap-2.5">
                <Thumbnail className="size-5 shrink-0 rounded-full" />
                <span className="text-ink">{post.nickname}</span>
                <span className="text-ink-muted">
                  · {formatRelativeTime(post.createdAt)}
                </span>
                {/* 자유 글에만 분류가 있습니다 */}
                {post.category && (
                  <Badge tone="neutral">
                    {
                      POST_CATEGORIES.find(
                        (item) => item.value === post.category,
                      )?.label
                    }
                  </Badge>
                )}
              </div>
            </div>

            {/* 향수 블록 — 후기는 항상, 자유 글은 걸었을 때만 */}
            {post.perfume && (
              <Link
                to={toPerfumeDetail(post.perfume.perfumeId)}
                className={cn(
                  'border-line-soft bg-surface-sunken hover:border-accent rounded-card',
                  // w-fit 으로 내용만큼만 차지합니다. 칸 전체를 채우면 향수 이름
                  // 하나가 제목만큼 넓은 띠가 되어 무엇이 제목인지 흐려집니다.
                  'inline-flex w-fit max-w-full items-baseline gap-2.5 border px-2.5 py-2.5',
                  'transition-colors duration-120 ease-out',
                  'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                )}
              >
                <span className="text-ink text-body font-medium">
                  {post.perfume.name}
                </span>
                <span className="text-ink-muted text-caption">
                  {post.perfume.brand}
                </span>
              </Link>
            )}

            {/* 점수나 별점은 없습니다. 좋아요만 있습니다. */}
            <div className="text-ink-muted text-caption flex items-center gap-3.75">
              <span className={post.liked ? 'text-danger' : undefined}>
                <span aria-hidden>{post.liked ? '♥' : '♡'}</span> 좋아요{' '}
                {post.likeCount}
              </span>
              <span>댓글 {post.commentCount}</span>
              <span>조회 {post.viewCount}</span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}
