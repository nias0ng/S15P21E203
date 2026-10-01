import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { withReturnPath } from '@/shared/lib/returnPath'

export function BackToLogin({ returnTo }: { returnTo?: string | null }) {
  const { t } = useTranslation('auth')
  return (
    <div className="text-caption flex items-center pl-1.25">
      <Link
        to={withReturnPath(ROUTES.LOGIN, returnTo)}
        className="text-ink-muted hover:text-ink"
      >
        {t('actions.backToLogin')}
      </Link>
    </div>
  )
}
