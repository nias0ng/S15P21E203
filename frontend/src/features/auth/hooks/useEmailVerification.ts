import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { apiErrorMessage, isApiError } from '@/shared/api/http'

import { confirmEmailVerification, requestEmailVerification } from '../api'
import { sanitizeVerificationCode } from '../lib/verification'
import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  type EmailVerificationConfirmInput,
} from '../types'

import { useCountdown } from './useCountdown'

type Verified = { email: string; token: string }

/** 번호가 죽어 새로 받아야만 하는 오류 */
const CODE_GONE = new Set([
  'AUTH_EMAIL_VERIFICATION_EXPIRED',
  'AUTH_EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS',
])

const EXPIRED_MESSAGE =
  '인증 시간이 지났습니다. [재인증] 을 눌러 다시 받아주세요'

function sendErrorMessage(error: unknown): string {
  if (isApiError(error) && error.code === 'AUTH_EMAIL_ALREADY_EXISTS') {
    return '이미 사용 중인 메일입니다.'
  }
  return apiErrorMessage(
    error,
    '인증번호를 보내지 못했습니다. 잠시 후 다시 시도해주세요.',
  )
}

function confirmErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return '확인하지 못했습니다. 잠시 후 다시 시도해주세요.'
  }
  if (error.code === 'AUTH_EMAIL_VERIFICATION_CODE_MISMATCH') {
    return '인증번호가 올바르지 않습니다'
  }
  if (CODE_GONE.has(error.code)) {
    return `${error.message} [재인증] 을 눌러 인증번호를 다시 받아주세요`
  }
  return error.message
}

/**
 * 회원가입 이메일 인증. 번호 보내기 → 번호 확인 → 가입 요청에 실을 토큰까지 들고 있습니다.
 *
 * 보낸 주소 · 인증된 주소를 함께 적어 두고 지금 이메일과 같을 때만 씁니다 — 요청이 날아가는
 * 사이 이메일을 고치면 늦게 온 응답이 새 주소의 인증처럼 보이면 안 됩니다.
 * 이메일을 고칠 때는 `reset` 으로 번호 · 타이머까지 모두 비웁니다.
 */
export function useEmailVerification(email: string) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verified, setVerified] = useState<Verified | null>(null)
  const codeTimer = useCountdown()
  const resendTimer = useCountdown()

  // 결과를 받는 콜백은 useMutation 옵션이 아니라 mutate 쪽에 둡니다. 옵션 콜백은 reset 한 뒤에도,
  // 다음 요청이 떠난 뒤에도 불려 늦게 온 옛 주소의 응답이 지금 진행 중인 인증을 지웁니다.
  // mutate 쪽 콜백은 마지막 요청에 대해서만, reset 전까지만 불립니다
  const confirmMutation = useMutation({
    mutationFn: (input: EmailVerificationConfirmInput) =>
      confirmEmailVerification(input),
  })

  const sendMutation = useMutation({
    mutationFn: (target: string) => requestEmailVerification(target),
  })

  const send = () =>
    sendMutation.mutate(email, {
      onSuccess: (data, target) => {
        setSentTo(target)
        setCode('')
        setVerified(null)
        confirmMutation.reset()
        codeTimer.start(data.expiresInSeconds)
        resendTimer.start(data.resendAvailableInSeconds)
      },
    })

  const confirm = () =>
    confirmMutation.mutate(
      { email, code },
      {
        onSuccess: (data, input) => {
          setVerified({ email: input.email, token: data.verificationToken })
          codeTimer.stop()
        },
        onError: (error) => {
          if (isApiError(error) && CODE_GONE.has(error.code)) {
            codeTimer.stop()
          }
        },
      },
    )

  const sent = sentTo !== null && sentTo === email
  const token =
    verified !== null && verified.email === email ? verified.token : null
  const codeRemaining = sent ? codeTimer.remaining : null
  const resendRemaining = sent ? (resendTimer.remaining ?? 0) : 0

  // 타이머가 살아 있어야 번호가 살아 있습니다. 만료 · 5회 실패 뒤에는 타이머를 멈춰 둡니다
  const codeUsable =
    sent && token === null && codeRemaining !== null && codeRemaining > 0
  // 번호는 죽었을 때만 다시 받습니다 — [확인] 이 [재인증] 으로 바뀌는 때입니다
  const needsResend = sent && token === null && !codeUsable
  const idle = !sendMutation.isPending && !confirmMutation.isPending

  const codeError =
    confirmMutation.error !== null
      ? confirmErrorMessage(confirmMutation.error)
      : codeRemaining === 0 && token === null
        ? EXPIRED_MESSAGE
        : undefined

  const reset = () => {
    setSentTo(null)
    setCode('')
    setVerified(null)
    codeTimer.stop()
    resendTimer.stop()
    sendMutation.reset()
    confirmMutation.reset()
  }

  return {
    sent,
    token,
    code,
    codeRemaining,
    codeUsable,
    codeError,
    sendError:
      sendMutation.error !== null
        ? sendErrorMessage(sendMutation.error)
        : undefined,
    needsResend,
    /** [인증하기] — 이 주소로 아직 보내지 않았을 때만. 다시 받는 것은 [재인증] 입니다 */
    canSend: email.length > 0 && !sent && token === null && idle,
    // 5번 틀려 번호가 1분 안에 죽으면 서버의 재전송 대기(60초)가 아직 남아 있습니다
    canResend: needsResend && resendRemaining === 0 && idle,
    canConfirm:
      codeUsable &&
      code.length === EMAIL_VERIFICATION_CODE_LENGTH &&
      // 번호를 다시 보내는 중이면 확인에 성공해도 뒤이어 온 전송 응답이 인증을 지웁니다
      idle,
    isSending: sendMutation.isPending,
    isConfirming: confirmMutation.isPending,
    changeCode: (input: string) => {
      setCode(sanitizeVerificationCode(input))
      // 틀렸다는 안내는 고쳐 쓰기 시작하면 걷습니다. 번호가 죽은 안내는 칸이 잠겨 여기로 오지 않습니다
      if (confirmMutation.error !== null) {
        confirmMutation.reset()
      }
    },
    send,
    confirm,
    reset,
  }
}
