import { EMAIL_VERIFICATION_CODE_LENGTH } from '../types'

/** 남은 초를 `mm:ss` 로. 음수 · 소수는 버려 0 아래로 내려가지 않게 합니다 */
export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0')
  const rest = String(whole % 60).padStart(2, '0')
  return `${minutes}:${rest}`
}

/**
 * 마감 시각까지 남은 초. 올림합니다 — 내림하면 04:59.4 가 04:59 가 아니라 04:58 로 보이고,
 * 1초도 안 남았을 때 00:00 으로 떠서 만료 전인데 만료 안내가 먼저 나갑니다.
 */
export function secondsUntil(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

/** 붙여넣기 · 자판 입력에서 숫자만 남기고 자릿수에서 자릅니다 */
export function sanitizeVerificationCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, EMAIL_VERIFICATION_CODE_LENGTH)
}
