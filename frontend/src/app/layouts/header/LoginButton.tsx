import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import { FOCUS, type Ink } from './tone'

export function LoginButton({ ink }: { ink: Ink }) {
  const { t } = useTranslation()

  return (
    <Link
      to={ROUTES.LOGIN}
      className={cn(
        'block border px-2.5 py-1.25',
        ink.login,
        'text-caption transition-colors duration-120 ease-out',
        FOCUS,
        ink.ring,
      )}
    >
      {t('actions.logIn')}
    </Link>
  )
}
