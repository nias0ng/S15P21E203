import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-ink-muted text-sm">존재하지 않는 페이지입니다.</p>
      <Link to={ROUTES.HOME} className="text-brand-600 text-sm underline">
        홈으로 돌아가기
      </Link>
    </div>
  )
}
