import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { useLocale } from '@/shared/store/localeStore'
import { AuthLinkButton } from '@/shared/ui/AuthLinkButton'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'

import { trendingPerfumesQuery } from '../queries'
import type { BoardItem } from '../types'

import { BoardHeader } from './BoardHeader'
import { PostList } from './PostList'
import { TrendingPerfumes } from './TrendingPerfumes'

type Props = {
  write: { to: string; label: string; description: string }
  filters: React.ReactNode
  title: string
  items: BoardItem[]
  isPending: boolean
  totalElements: number | undefined
  onToggleLike: (item: BoardItem) => void
  page: number
  size: number
  onPageChange: (page: number) => void
  paginationLabel: string
  children?: React.ReactNode
}

export function BoardShell({
  write,
  filters,
  title,
  items,
  isPending,
  totalElements,
  onToggleLike,
  page,
  size,
  onPageChange,
  paginationLabel,
  children,
}: Props) {
  const { t } = useTranslation('community')
  const locale = useLocale()
  const trending = useQuery(trendingPerfumesQuery())

  const showTrending =
    trending.isPending || (trending.data?.perfumes.length ?? 0) > 0

  const writeButton = (
    <AuthLinkButton to={write.to} size="sm" description={write.description}>
      {write.label}
    </AuthLinkButton>
  )

  return (
    <div className="space-y-7.5">
      <BoardHeader action={writeButton} />

      <div
        className={cn(
          'grid gap-x-6.25 gap-y-3.75',
          showTrending && 'lg:grid-cols-[1fr_calc(var(--spacing)*63.75)]',
        )}
      >
        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1">
          {filters}
        </div>

        <section
          className={cn(GLASS_PANEL, 'min-w-0 lg:col-start-1 lg:row-start-2')}
        >
          <div className="mb-6.25 flex items-baseline gap-2.5">
            <h2 className="text-ink font-serif text-2xl">{title}</h2>
            {!isPending && !!totalElements && (
              <span className="text-ink-muted text-caption">
                {t('board.total', {
                  total: totalElements.toLocaleString(locale),
                })}
              </span>
            )}
          </div>

          <PostList
            items={items}
            isPending={isPending}
            onToggleLike={onToggleLike}
            emptyAction={writeButton}
          />

          <Pagination
            className="mt-6.25"
            label={paginationLabel}
            page={page}
            size={size}
            totalElements={totalElements ?? 0}
            onPageChange={onPageChange}
          />
        </section>

        <TrendingPerfumes
          className="lg:col-start-2 lg:row-start-2"
          data={trending.data}
        />
      </div>

      {children}
    </div>
  )
}
