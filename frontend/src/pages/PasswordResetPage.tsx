import { useSearchParams } from 'react-router'

import { PasswordFindForm, PasswordResetForm } from '@/features/auth'

/**
 * 비밀번호 찾기 · 재설정 (A31). 한 경로에서 두 단계입니다 — `?token=` 없이
 * 들어오면 찾기(메일 발송), 달고 들어오면 재설정.
 */
export default function PasswordResetPage() {
  const [searchParams] = useSearchParams()
  const hasToken = Boolean(searchParams.get('token'))

  return (
    <div className="flex justify-center py-6.25">
      {hasToken ? <PasswordResetForm /> : <PasswordFindForm />}
    </div>
  )
}
