/**
 * 인증 · 계정 도메인 공개 API (COM-01, COM-02, COM-03, COM-04, COM-06)
 *
 * 이 폴더 밖에서는 `@/features/auth` 만 import 합니다.
 * 화면: A28 로그인·회원가입 / A29 정보 변경 / A30 비밀번호 변경·탈퇴 모달
 *      A31 비밀번호 찾기·재설정 / A32 약관 동의
 *
 * 로그인 · 회원가입 · 비밀번호 변경 · 탈퇴는 실제 API 입니다. **비밀번호 재설정(A31)과
 * 닉네임 수정(A29)은 엔드포인트가 없어** 화면만 있습니다.
 */
export { AccountForm } from './components/AccountForm'
export { AuthCard } from './components/AuthCard'
export { LoginForm } from './components/LoginForm'
export { PasswordChangeModal } from './components/PasswordChangeModal'
export {
  PasswordFindForm,
  PasswordResetForm,
} from './components/PasswordResetForm'
export { SignupForm } from './components/SignupForm'
export { TermsAgreement } from './components/TermsAgreement'
export { EMPTY_TERMS, hasAgreedRequired, TERMS } from './terms'
export type { TermId, TermsState } from './terms'
export { WithdrawModal } from './components/WithdrawModal'
export {
  changePassword,
  checkNicknameAvailability,
  getMe,
  login,
  logout,
  signup,
  toAuthUser,
  withdraw,
} from './api'
export { authKeys, meQuery } from './queries'
export {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type LoginInput,
  type PasswordChangeInput,
  type SignupInput,
  type UserResponse,
} from './types'
