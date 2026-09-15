import { Link } from 'react-router'

import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { POST_CATEGORIES, type BoardItem } from '../types'

type Props = {
  items: BoardItem[]
  isPending?: boolean
  emptyAction?: React.ReactNode
}

/**
 * 게시글 목록 (와이어프레임 A22a · A22b 공용)
 *
 * 두 게시판이 같은 컴포넌트를 씁니다. 백엔드 응답은 서로 다르지만
 * (`/posts` 와 `/reviews`) 카드 모양이 같아, 도메인에서 `BoardItem` 으로 맞춰
 * 넘깁니다(types.ts 의 `postToBoardItem` · `reviewToBoardItem`).
 *
 * 값이 있을 때만 그리는 것 — 향수 블록(자유 글은 안 걸어도 됨), 분류 배지(후기에는
 * 없음), 댓글 수(후기에는 댓글 자체가 없음).
 *
 * 제목이 맨 위인 이유: 게시판에서 훑는 것은 제목입니다.
 */
export function PostList({ items, isPending = false, emptyAction }: Props) {
  if (isPending) {
    return (
      <div className="space-y-3.75">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="rounded-card h-32.5" />
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
    <ul className="space-y-3.75">
      {items.map((item) => (
        <li key={item.id}>
          {/*
            카드 전체가 아니라 제목만 링크입니다. 카드를 통째로 링크로 감싸면 안에
            있는 향수 블록 링크가 링크 안의 링크가 되어 낭독기와 브라우저가 둘 다
            헷갈립니다. 대신 카드에 group 을 걸어 어디에 마우스를 올리든 제목에
            밑줄이 들어옵니다.
          */}
          <Card interactive className="group space-y-2.5">
            <div className="space-y-2.5">
              <Link
                to={item.to}
                className={cn(
                  'text-ink text-heading block font-serif font-bold',
                  'underline-offset-4 group-hover:underline',
                  'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2',
                )}
              >
                {item.title}
              </Link>

              <div className="text-caption flex flex-wrap items-center gap-2.5">
                <Thumbnail className="size-5 shrink-0 rounded-full" />
                {/* 탈퇴한 회원의 글은 글만 남고 작성자가 지워집니다 */}
                <span className="text-ink">
                  {item.nickname ?? '탈퇴한 회원'}
                </span>
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

            {/* 향수 블록 — 후기는 항상, 자유 글은 걸었을 때만 */}
            {item.perfume && (
              <Link
                to={toPerfumeDetail(item.perfume.perfumeId)}
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
                  {item.perfume.name}
                </span>
                {/* 브랜드가 없는 향수가 있습니다 */}
                {item.perfume.brand && (
                  <span className="text-ink-muted text-caption">
                    {item.perfume.brand}
                  </span>
                )}
              </Link>
            )}

            {/* 점수나 별점은 없습니다. 좋아요만 있습니다. */}
            <div className="text-ink-muted text-caption flex items-center gap-3.75">
              <span className={item.liked ? 'text-danger' : undefined}>
                <span aria-hidden>{item.liked ? '♥' : '♡'}</span> 좋아요{' '}
                {item.likeCount}
              </span>
              {item.commentCount !== null && (
                <span>댓글 {item.commentCount}</span>
              )}
              <span>조회 {item.viewCount}</span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}
