import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'

export function NotFoundPage() {
  const { t } = useTranslation(['layout', 'common'])

  return (
    <div className="flex flex-col items-center gap-3.75 py-23.75 text-center">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-ink-muted text-sm">{t('notFound.description')}</p>
      <Link to={ROUTES.HOME} className="text-ink text-sm underline">
        {t('common:actions.goHome')}
      </Link>
    </div>
  )
}
