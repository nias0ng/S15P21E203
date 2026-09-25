import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { withReturnPath } from '@/shared/lib/returnPath'

/**
 * 로그인으로 돌아가는 줄 (회원가입 · 비밀번호 찾기 · 재설정). 판의 모서리가 둥글어
 * 5px 을 들여씁니다.
 *
 * @param props.returnTo 로그인을 마치고 돌아갈 자리. 없으면 로그인만 엽니다
 */
export function BackToLogin({ returnTo }: { returnTo?: string | null }) {
  return (
    <div className="text-caption flex items-center pl-1.25">
      <Link
        to={withReturnPath(ROUTES.LOGIN, returnTo)}
        className="text-ink-muted hover:text-ink"
      >
        로그인하기 →
      </Link>
    </div>
  )
}
