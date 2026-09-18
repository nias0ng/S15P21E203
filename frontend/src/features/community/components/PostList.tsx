import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { POST_CATEGORIES, type BoardItem } from '../types'

type Props = {
  items: BoardItem[]
  isPending?: boolean
  emptyAction?: React.ReactNode
  /**
   * 넘기면 좋아요가 **누를 수 있는 버튼**이 됩니다. 안 넘기면 숫자만 보여줍니다.
   *
   * 누를 수 없을 때 버튼으로 두지 않는 이유: 눌러도 아무 일이 없으면 고장난
   * 것으로 보입니다. 붙지 않은 기능은 아예 버튼이 아니어야 합니다.
   */
  onToggleLike?: (item: BoardItem) => void
}

/**
 * 게시글 목록 (와이어프레임 A22a · A22b 공용)
 *
 * **유리판 한 장 위에 줄로 눕습니다.** 향수 상세(A10)의 후기 목록과 같은 모양입니다 —
 * 글은 세로로 길게 이어지는 글자 덩어리라, 한 줄 한 줄을 밝은 카드로 띄우면 판보다
 * 카드가 무거워져 유리판이 카드 사이 틈으로만 보입니다. 격자(향수 · 브랜드 · 노트)가
 * 카드를 쓰는 것은 타일이 작고 사진이 주인공이라서입니다.
 *
 * 두 게시판이 같은 컴포넌트를 씁니다. 백엔드 응답은 서로 다르지만
 * (`/posts` 와 `/reviews`) 줄 모양이 같아, 도메인에서 `BoardItem` 으로 맞춰
 * 넘깁니다(types.ts 의 `postToBoardItem` · `reviewToBoardItem`).
 *
 * 값이 있을 때만 그리는 것 — 향수 블록(자유 글은 안 걸어도 됨), 분류 배지(후기에는
 * 없음), 댓글 수(후기에는 댓글 자체가 없음).
 *
 * 제목이 맨 위인 이유: 게시판에서 훑는 것은 제목입니다.
 */
export function PostList({
  items,
  isPending = false,
  emptyAction,
  onToggleLike,
}: Props) {
  if (isPending) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="rounded-card h-25" />
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
    <ul className="divide-line divide-y">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            'relative space-y-2.5 px-2.5 py-3.75',
            /*
              판 위의 hover 는 **어둡게** 합니다 — 유리가 반투명이라 뒤의 방이 더
              비쳐 그 줄이 유리 안으로 가라앉습니다
              (styles/scent-display.css 의 `--color-surface-sunken`).
            */
            'hover:bg-surface-sunken rounded-card',
            'transition-colors duration-120 ease-out',
          )}
        >
          <div className="space-y-2.5">
            {/*
              제목 링크를 `after:inset-0` 으로 줄 전체만큼 늘립니다. 줄 어디를
              눌러도 글로 가고, 낭독기에는 링크가 여전히 제목 하나입니다 —
              `<li>` 를 통째로 링크로 감싸면 안에 있는 좋아요 버튼이 링크 안의
              버튼이 되어 잘못된 마크업이 됩니다.
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
            어느 향수 이야기인지 — 후기는 항상, 자유 글은 걸었을 때만.

            **누르는 곳이 아니라 표시입니다.** 예전에는 향수 상세로 가는 링크였는데,
            게시판에서 글을 누르려다 이 블록을 밟으면 글이 아니라 향수로 새 버립니다.
            줄 전체가 글로 가는 지금은 그 사고가 더 잦아집니다. 향수로 건너가는 길은
            **글 상세(A23)의 `연결된 향수`** 한 곳으로 모읍니다 — 글을 읽고 나서
            건너가는 것이 순서이기도 합니다.

            바탕을 칠하지 않고 테두리만 두릅니다. 줄 hover 가 바탕을 어둡게 하는데
            이 블록도 바탕을 깔면 hover 때 둘이 같은 색이 되어 블록이 사라집니다.
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
          <div className="text-ink-muted text-caption flex items-center gap-3.75">
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
