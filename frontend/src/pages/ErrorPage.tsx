import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { apiErrorMessage, isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'

export function ErrorPage() {
  const { t } = useTranslation(['layout', 'common'])
  const error = useRouteError()
  const unknown = t('errorPage.unknown')

  // 서버 오류는 화면 언어에 맞는 문구로 고릅니다. 그 밖의 오류 문구는 코드가 낸 것이라 그대로 둡니다
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : isApiError(error)
      ? apiErrorMessage(error, unknown)
      : error instanceof Error
        ? error.message
        : unknown

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3.75 px-3.75 text-center">
      <h1 className="text-xl font-semibold">{t('errorPage.title')}</h1>
      <p className="text-ink-muted text-sm">{message}</p>
      <Link to={ROUTES.HOME} className="text-ink text-sm underline">
        {t('common:actions.goHome')}
      </Link>
    </div>
  )
}
