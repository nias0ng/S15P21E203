import { SCENT_FAMILY_NAMES } from '@/shared/config/scentFamilies'
import { i18n } from '@/shared/i18n'

import {
  SCENT_FAMILY_KEYS,
  type ScentFamilyKey,
  type ScentFamilyLabel,
} from './types'

export const MAX_PICKS = 2

const messageKey = (key: ScentFamilyKey) =>
  key.toLowerCase() as Lowercase<ScentFamilyKey>

/**
 * 향 계열의 형용사 · 이름. **부를 때** 화면 언어로 읽습니다 — 모듈 상수에 담아 두면 언어를
 * 바꿔도 앞 언어로 남습니다.
 */
export function scentFamilyLabel(key: ScentFamilyKey): ScentFamilyLabel {
  if (!SCENT_FAMILY_KEYS.includes(key)) {
    throw new Error(`알 수 없는 향 계열입니다: ${key}`)
  }
  return {
    key,
    adjective: i18n.t(`taste:families.${messageKey(key)}`),
    name: SCENT_FAMILY_NAMES[key],
  }
}

export function familyAdjective(key: ScentFamilyKey): string {
  return scentFamilyLabel(key).adjective
}

export function familyAriaLabel(key: ScentFamilyKey): string {
  const { adjective, name } = scentFamilyLabel(key)
  return `${adjective} · ${name}`
}
