import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL_ASIDE } from '@/shared/ui/panel'

import type { TrendingPerfumesResponse } from '../types'

type Props = {
  data: TrendingPerfumesResponse | undefined
  className?: string
}

export function TrendingPerfumes({ data, className }: Props) {
  const { t } = useTranslation('community')

  if (!data || data.perfumes.length === 0) return null

  return (
    <aside className={cn(GLASS_PANEL_ASIDE, 'self-start', className)}>
      <h2 className="text-ink text-heading font-serif font-bold break-keep">
        {t('trending.title')}
      </h2>

      <ol className="mt-2.5 space-y-1.25">
        {data.perfumes.map((item, rank) => (
          <li key={item.perfumeId}>
            <Link
              to={toPerfumeDetail(item.perfumeId)}
              state={perfumeViewState('COMMUNITY')}
              className={cn(
                'hover:bg-surface-sunken rounded-card flex items-baseline gap-2.5 px-2.5 py-2.5',
                'transition-colors duration-120 ease-out',
                'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
              )}
            >
              <span className="text-ink-muted text-caption w-3.75 min-w-[15px] shrink-0 tabular-nums">
                {rank + 1}
              </span>
              <span className="text-ink text-body min-w-0 flex-1 truncate">
                {item.name}
              </span>
              <span className="text-ink-muted text-caption shrink-0">
                {item.mentionCount}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="text-ink-muted text-caption border-line-soft mt-2.5 border-t pt-2.5 break-keep">
        {t('trending.caption', { count: data.days })}
      </p>
    </aside>
  )
}
