import { useSearchParams } from 'react-router'

import { AUTH_PAGE, PasswordFindForm, PasswordResetForm } from '@/features/auth'

/** 비밀번호 찾기 · 재설정 (A31). `?token=` 없이 들어오면 찾기, 달고 들어오면 재설정 */
export default function PasswordResetPage() {
  const [searchParams] = useSearchParams()
  const hasToken = Boolean(searchParams.get('token'))

  return (
    <div className={AUTH_PAGE}>
      {hasToken ? <PasswordResetForm /> : <PasswordFindForm />}
    </div>
  )
}
