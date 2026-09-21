import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import { type Ink } from './tone'

export function LoginButton({ ink }: { ink: Ink }) {
  return (
    <Link
      to={ROUTES.LOGIN}
      className={cn(
        'rounded-card block border px-2.5 py-1.25',
        ink.login,
        'text-caption transition-colors duration-120 ease-out',
        'outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        ink.ring,
      )}
    >
      로그인
    </Link>
  )
}
