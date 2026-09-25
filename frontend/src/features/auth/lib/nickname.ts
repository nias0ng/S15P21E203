import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '../types'

export function nicknameLengthError(trimmed: string): string | undefined {
  return trimmed.length > 0 &&
    (trimmed.length < NICKNAME_MIN_LENGTH ||
      trimmed.length > NICKNAME_MAX_LENGTH)
    ? `닉네임은 공백을 제외하고 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자입니다`
    : undefined
}
