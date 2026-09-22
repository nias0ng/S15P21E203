import { AUTH_PAGE, SignupForm } from '@/features/auth'

/** 회원가입 (와이어프레임 A28 — COM-01) */
export default function SignupPage() {
  return (
    <div className={AUTH_PAGE}>
      <SignupForm />
    </div>
  )
}
