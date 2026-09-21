import { AccountForm, AUTH_PAGE } from '@/features/auth'

/**
 * 정보 변경 (와이어프레임 A29 + A30 — COM-04 · COM-06)
 *
 * 로그인 · 회원가입 · 비밀번호와 **같은 어두운 방 · 같은 틀**입니다
 * (S15P21E203-358). 로그인에서 여기로 한 번에 넘어가는 사이라 톤이 갈리면
 * 안 됩니다 — 판정 기준은 `docs/어두운-방-유리판.md` 에 있습니다.
 */
export default function AccountPage() {
  return (
    <div className={AUTH_PAGE}>
      <AccountForm />
    </div>
  )
}
