import { AccountForm, AUTH_PAGE } from '@/features/auth'

/**
 * 정보 변경 (A29 + A30 — COM-04 · COM-06). 로그인에서 한 번에 넘어오는 사이라
 * 로그인 · 회원가입 · 비밀번호와 같은 틀입니다 — docs/어두운-방-유리판.md
 */
export default function AccountPage() {
  return (
    <div className={AUTH_PAGE}>
      <AccountForm />
    </div>
  )
}
