import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { ROUTES } from '@/shared/config/routes'

export function ErrorPage() {
  const error = useRouteError()

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : '알 수 없는 오류가 발생했습니다.'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">문제가 발생했어요</h1>
      <p className="text-ink-muted text-sm">{message}</p>
      <Link to={ROUTES.HOME} className="text-brand-600 text-sm underline">
        홈으로 돌아가기
      </Link>
    </div>
  )
}
