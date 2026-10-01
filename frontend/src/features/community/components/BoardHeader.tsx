import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

type Props = {
  action?: React.ReactNode
}

const TABS = [
  { to: ROUTES.COMMUNITY_REVIEWS, labelKey: 'board.reviewsTab' },
  { to: ROUTES.COMMUNITY_FREE, labelKey: 'board.freeTab' },
] as const

export function BoardHeader({ action }: Props) {
  const { t } = useTranslation('community')

  return (
    <header className="space-y-6.25">
      <h1 className="text-ink text-display text-center font-serif font-bold">
        {t('board.heading')}
      </h1>

      <div className="border-line grid grid-cols-[1fr_auto_1fr] items-end gap-3.75 border-b">
        <div aria-hidden />

        <nav aria-label={t('board.tabsLabel')} className="flex justify-center">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'text-body px-3.75 py-2.5 font-medium',
                  'transition-colors duration-120 ease-out',
                  'focus-visible:ring-accent-deep rounded-t-card outline-none focus-visible:ring-2',
                  isActive
                    ? 'border-ink text-ink -mb-px border-b-2'
                    : 'text-ink-muted hover:text-ink border-b-2 border-transparent',
                )
              }
            >
              {t(tab.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="mb-1.25 flex justify-end">{action}</div>
      </div>
    </header>
  )
}
