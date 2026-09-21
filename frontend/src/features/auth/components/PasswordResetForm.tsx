import { useState } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { AUTH_SUBMIT } from '../frame'
import { PASSWORD_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'

/**
 * 로그인으로 돌아가는 줄. 두 카드가 같이 씁니다.
 *
 * 비밀번호 화면은 **막다른 곳이었습니다** — 로그인에서 들어올 수는 있는데 나가는
 * 길이 없어 헤더로 올라가야 했습니다. 회원가입이 357 에서 같은 이유로 길을
 * 냈습니다(`SignupForm` 의 [로그인하기 →]).
 *
 * 모양 · 자리 · 들여쓰기를 저쪽과 같게 둡니다 — 화면을 오갈 때 링크가 같은 자리에
 * 있어야 눈이 찾지 않습니다. 5px 을 들여쓰는 것은 판의 모서리가 둥글어 왼쪽 끝에
 * 딱 붙이면 글자가 밖으로 새어 나간 것처럼 보이기 때문입니다.
 */
function BackToLogin() {
  return (
    <div className="text-caption flex items-center pl-1.25">
      <Link to={ROUTES.LOGIN} className="text-ink-muted hover:text-ink">
        로그인하기 →
      </Link>
    </div>
  )
}

/**
 * 비밀번호 찾기 (와이어프레임 A31 좌측 카드)
 *
 * 메일을 보낸 뒤에는 **폼을 안내로 바꿉니다.** 폼을 두고 안내만 덧붙이면 보낸
 * 것인지 아닌지가 화면에 함께 떠 있어, 같은 메일을 몇 번씩 부르게 됩니다.
 */
export function PasswordFindForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (sentTo !== null) {
    return (
      <AuthCard
        title="메일을 보냈습니다"
        description="받은 메일함의 링크로 비밀번호를 다시 정하세요"
      >
        {/* 폼 제출 결과라 화면 낭독기에도 알립니다 */}
        <p
          aria-live="polite"
          className="border-line bg-line-soft text-ink text-caption border p-2.5"
        >
          {sentTo} 으로 재설정 링크를 보냈습니다. 메일이 안 보이면 스팸함도
          확인해주세요.
        </p>

        {/*
          다시 보내기는 **폼으로 되돌리는 것**입니다. 여기서 바로 부르지 않는 이유는
          주소를 잘못 적어 못 받는 경우가 대부분이라, 같은 주소로 또 보내면 같은 일이
          반복됩니다.
        */}
        <Button variant="outline" fullWidth onClick={() => setSentTo(null)}>
          다른 이메일로 다시 받기
        </Button>

        <BackToLogin />
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="비밀번호 찾기"
      description="가입한 이메일로 재설정 링크를 보냅니다"
    >
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          // TODO: 재설정 메일 발송 API 연결
          setSentTo(String(form.get('email') ?? ''))
        }}
      >
        <Input
          label="이메일"
          hideLabel
          name="email"
          type="email"
          autoComplete="email"
          placeholder="이메일"
          required
        />
        <Button type="submit" fullWidth className={AUTH_SUBMIT}>
          메일 받기
        </Button>
      </form>

      <BackToLogin />
    </AuthCard>
  )
}

/**
 * 비밀번호 재설정 (와이어프레임 A31 우측 카드 — 메일 링크로 진입)
 *
 * 두 칸이 같은지 화면에서 봅니다. 규칙 · 문구는 정보 변경의
 * `PasswordChangeModal` 과 같은 것을 씁니다 — 같은 일을 하는 칸이 화면마다 다른
 * 말을 하면 둘 중 하나가 틀린 것처럼 읽힙니다.
 */
export function PasswordResetForm() {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const passwordError =
    password.length > 0 && password.length < PASSWORD_MIN_LENGTH
      ? `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`
      : undefined

  const confirmError =
    passwordConfirm.length > 0 && passwordConfirm !== password
      ? '비밀번호가 서로 다릅니다'
      : undefined

  const canSubmit =
    password.length >= PASSWORD_MIN_LENGTH && passwordConfirm === password

  return (
    <AuthCard
      title="비밀번호 재설정"
      description="새로 쓸 비밀번호를 정해주세요"
    >
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          // TODO: 비밀번호 재설정 API 연결 후 로그인 처리
        }}
      >
        <Input
          label="새 비밀번호"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordError}
        />
        <Input
          label="새 비밀번호 확인"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호 확인"
          required
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          error={confirmError}
        />

        <p className="text-ink-muted text-caption">
          비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이어야 합니다.
        </p>

        <Button
          type="submit"
          fullWidth
          className={AUTH_SUBMIT}
          disabled={!canSubmit}
        >
          변경하고 로그인
        </Button>
      </form>

      <BackToLogin />
    </AuthCard>
  )
}
