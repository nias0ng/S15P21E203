import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { withReturnPath } from '@/shared/lib/returnPath'

export function BackToLogin({ returnTo }: { returnTo?: string | null }) {
  return (
    <div className="text-caption flex items-center pl-1.25">
      <Link
        to={withReturnPath(ROUTES.LOGIN, returnTo)}
        className="text-ink-muted hover:text-ink"
      >
        로그인하기 →
      </Link>
    </div>
  )
}
