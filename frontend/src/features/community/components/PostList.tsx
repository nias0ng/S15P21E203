import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { POST_CATEGORIES, type BoardItem } from '../types'

/**
 * 두 게시판이 같이 쓰는 격자. **불러오는 중과 다 온 뒤가 같은 값이어야** 자리표시자
 * 자리에 카드가 그대로 앉습니다 — 다르면 목록이 뜨는 순간 화면이 한 번 튑니다.
 *
 * 좁은 화면에서는 한 줄입니다. 자유 게시판은 곁판(255px)까지 있어 `sm` 아래에서
 * 2열로 쪼개면 카드 하나가 제목 두 줄도 못 담습니다.
 */
const GRID = 'grid gap-3.75 sm:grid-cols-2'

type Props = {
  items: BoardItem[]
  isPending?: boolean
  emptyAction?: React.ReactNode
  /**
   * 넘기면 좋아요가 **누를 수 있는 버튼**이 됩니다. 안 넘기면 숫자만 — 눌러도 아무
   * 일이 없으면 고장난 것으로 보입니다.
   */
  onToggleLike?: (item: BoardItem) => void
}

/**
 * 게시글 목록 (A22a · A22b 공용). 백엔드 응답은 서로 다르지만 줄 모양이 같아
 * 도메인에서 `BoardItem` 으로 맞춰 넘깁니다. 향수 블록 · 분류 배지 · 댓글 수는
 * 값이 있을 때만 그립니다.
 */
export function PostList({
  items,
  isPending = false,
  emptyAction,
  onToggleLike,
}: Props) {
  if (isPending) {
    return (
      <div className={GRID}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="rounded-card h-40" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="이 게시판에 글이 없습니다"
        description="첫 글을 남겨보세요."
        action={emptyAction}
      />
    )
  }

  return (
    <ul className={GRID}>
      {items.map((item) => (
        <li
          key={item.id}
          /* 화면 테마가 붙잡을 자리 이름 — 유리판 위에서 밝은 카드가 됩니다 */
          data-slot="card"
          className={cn(
            'border-line bg-surface-card rounded-card relative border',
            'flex flex-col gap-2.5 p-3.75',
            'transition-[transform,box-shadow] duration-200 ease-out',
            'hover:shadow-raised hover:-translate-y-1.25',
          )}
        >
          <div className="space-y-2.5">
            {/*
              제목 링크를 `after:inset-0` 으로 줄 전체만큼 늘립니다 — `<li>` 를
              통째로 감싸면 안의 좋아요 버튼이 링크 안의 버튼이 됩니다.
            */}
            <Link
              to={item.to}
              className={cn(
                'text-ink text-heading block font-serif font-bold',
                'underline-offset-4 hover:underline',
                'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2',
                'after:absolute after:inset-0',
              )}
            >
              {item.title}
            </Link>

            <div className="text-caption flex flex-wrap items-center gap-2.5">
              <Thumbnail className="size-5 shrink-0 rounded-full" />
              {/* 탈퇴한 회원의 글은 글만 남고 작성자가 지워집니다 */}
              <span className="text-ink">{item.nickname ?? '탈퇴한 회원'}</span>
              <span className="text-ink-muted">
                · {formatRelativeTime(item.createdAt)}
              </span>
              {/* 자유 글에만 분류가 있습니다 */}
              {item.category && (
                <Badge tone="neutral">
                  {
                    POST_CATEGORIES.find(
                      (entry) => entry.value === item.category,
                    )?.label
                  }
                </Badge>
              )}
            </div>
          </div>

          {/*
            어느 향수 이야기인지. **누르는 곳이 아니라 표시입니다** — 링크였을 때
            글을 누르려다 밟으면 향수로 샜습니다. 건너가는 길은 글 상세뿐입니다.
          */}
          {item.perfume && (
            <p className="border-line rounded-card inline-flex w-fit max-w-full items-baseline gap-2.5 border px-2.5 py-1.25">
              <span className="text-ink text-body font-medium">
                {item.perfume.name}
              </span>
              {/* 브랜드가 없는 향수가 있습니다 */}
              {item.perfume.brand && (
                <span className="text-ink-muted text-caption">
                  {item.perfume.brand}
                </span>
              )}
            </p>
          )}

          {/* 점수나 별점은 없습니다. 좋아요만 있습니다. */}
          <div className="text-ink-muted text-caption mt-auto flex items-center gap-3.75">
            {onToggleLike ? (
              /*
                위 제목 링크가 줄 전체를 덮고 있으므로 `relative` 로 그 위에
                올립니다. 안 그러면 좋아요를 눌러도 글로 넘어갑니다.
              */
              <button
                type="button"
                aria-pressed={item.liked}
                aria-label={`좋아요 ${item.likeCount}`}
                onClick={() => onToggleLike(item)}
                className={cn(
                  'hover:text-danger rounded-card relative transition-colors duration-120 ease-out',
                  'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                  item.liked && 'text-danger',
                )}
              >
                <span aria-hidden>{item.liked ? '♥' : '♡'}</span> 좋아요{' '}
                {item.likeCount}
              </button>
            ) : (
              <span className={item.liked ? 'text-danger' : undefined}>
                <span aria-hidden>{item.liked ? '♥' : '♡'}</span> 좋아요{' '}
                {item.likeCount}
              </span>
            )}
            {item.commentCount !== null && (
              <span>댓글 {item.commentCount}</span>
            )}
            <span>조회 {item.viewCount}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
