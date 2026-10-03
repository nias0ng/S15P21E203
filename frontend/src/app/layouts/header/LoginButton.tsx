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
        // NOTE: 한 줄로 둡니다 — 390 폭에서 오른쪽 묶음이 좁아지면 영어 'Log in' 이 띄어쓰기에서 두 줄로 꺾였습니다.
        //   한국어 '로그인' 은 body 의 keep-all 이 이미 한 덩이로 둡니다
        'block border px-2.5 py-1.25 whitespace-nowrap',
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
