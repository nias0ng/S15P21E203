import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '../types'

/**
 * 닉네임 길이 규칙 (회원가입 · 정보 변경). 백엔드 DTO 의 `@Size(min = 2, max = 20)` 와
 * 같아야 400 이 안 납니다.
 *
 * @param trimmed 앞뒤 공백을 뗀 닉네임 — 서버가 뗀 뒤에 셉니다
 * @returns 어긋나면 칸 아래에 띄울 문구. 비어 있거나 맞으면 `undefined`
 */
export function nicknameLengthError(trimmed: string): string | undefined {
  return trimmed.length > 0 &&
    (trimmed.length < NICKNAME_MIN_LENGTH ||
      trimmed.length > NICKNAME_MAX_LENGTH)
    ? `닉네임은 공백을 제외하고 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자입니다`
    : undefined
}
