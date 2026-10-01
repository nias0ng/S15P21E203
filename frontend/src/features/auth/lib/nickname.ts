import { i18n } from '@/shared/i18n'

import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '../types'

export function nicknameLengthError(trimmed: string): string | undefined {
  return trimmed.length > 0 &&
    (trimmed.length < NICKNAME_MIN_LENGTH ||
      trimmed.length > NICKNAME_MAX_LENGTH)
    ? i18n.t('auth:nickname.lengthRule', {
        min: NICKNAME_MIN_LENGTH,
        max: NICKNAME_MAX_LENGTH,
      })
    : undefined
}
