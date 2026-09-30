import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { localizedBrand, localizedName } from '@/shared/i18n/locale'
import { authorName } from '@/shared/lib/authorName'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { useLocale } from '@/shared/store/localeStore'
import { Badge } from '@/shared/ui/Badge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { BoardItem } from '../types'

const GRID = 'grid gap-3.75 sm:grid-cols-2'

type Props = {
  items: BoardItem[]
  isPending: boolean
  emptyAction: React.ReactNode
  onToggleLike: (item: BoardItem) => void
}

export function PostList({
  items,
  isPending,
  emptyAction,
  onToggleLike,
}: Props) {
  const { t } = useTranslation('community')
  const locale = useLocale()

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
        title={t('board.emptyTitle')}
        description={t('board.emptyDescription')}
        action={emptyAction}
      />
    )
  }

  return (
    <ul className={GRID}>
      {items.map((item) => (
        <li
          key={item.id}
          data-slot="card"
          className={cn(
            'scent-paper border-line bg-surface-card rounded-card relative border',
            'flex flex-col gap-2.5 px-4.75 py-4.25',
            'transition-[transform,box-shadow] duration-200 ease-out',
            'hover:shadow-raised hover:-translate-y-1.25',
          )}
        >
          <div className="space-y-2.5">
            <Link
              to={item.to}
              className={cn(
                'text-ink text-heading block font-serif font-bold',
                'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2',
                'after:absolute after:inset-0',
              )}
            >
              {item.title}
            </Link>

            <div className="text-caption flex flex-wrap items-center gap-2.5">
              <Thumbnail
                src={item.avatarUrl}
                className="size-5 shrink-0 rounded-full"
              />
              <span className="text-ink">{authorName(item.nickname)}</span>
              <span className="text-ink-muted">
                · {formatRelativeTime(item.createdAt)}
              </span>
              {item.category && (
                <Badge tone="neutral">{t(`categories.${item.category}`)}</Badge>
              )}
            </div>
          </div>

          {item.content && (
            <p className="text-ink/85 text-body line-clamp-5 px-1.25 whitespace-pre-wrap">
              {item.content}
            </p>
          )}

          {item.perfume && (
            <p className="border-line rounded-card inline-flex w-fit max-w-full items-baseline gap-2.5 border px-2.5 py-1.25">
              <span className="text-ink text-body font-medium">
                {localizedName(locale, item.perfume.name, item.perfume.nameKo)}
              </span>
              {item.perfume.brand && (
                <span className="text-ink-muted text-caption">
                  {localizedBrand(
                    locale,
                    item.perfume.brand,
                    item.perfume.brandKo,
                  )}
                </span>
              )}
            </p>
          )}

          <div className="text-ink-muted text-caption mt-auto flex items-center gap-3.75">
            <button
              type="button"
              aria-pressed={item.liked}
              aria-label={t('board.likes', { count: item.likeCount })}
              onClick={() => onToggleLike(item)}
              className={cn(
                'rounded-card relative transition-colors duration-120 ease-out',
                'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                'hover:[&>[aria-hidden]]:text-like',
              )}
            >
              <span
                aria-hidden
                className={item.liked ? 'text-like' : undefined}
              >
                {item.liked ? '♥' : '♡'}
              </span>{' '}
              {t('board.likes', { count: item.likeCount })}
            </button>
            {item.commentCount !== null && (
              <span>{t('board.comments', { count: item.commentCount })}</span>
            )}
            <span>{t('board.views', { count: item.viewCount })}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
