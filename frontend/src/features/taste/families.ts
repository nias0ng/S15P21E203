import { SCENT_FAMILY_NAMES } from '@/shared/config/scentFamilies'

import {
  SCENT_FAMILY_KEYS,
  type ScentFamilyKey,
  type ScentFamilyLabel,
} from './types'

/** 고르기 전 타일에 보이는 낱말. `Record` 라 계열이 늘면 여기서 타입 오류가 납니다 */
const ADJECTIVES: Record<ScentFamilyKey, string> = {
  FLORAL: '화사한',
  GREEN: '싱그러운',
  CITRUS: '상큼한',
  FRUITY: '발랄한',
  AQUATIC: '시원한',
  MUSK: '포근한',
  GOURMAND: '달콤한',
  WOODY: '차분한',
  AMBER: '따뜻한',
}

/** 계열 9개의 화면 문구. 배열 순서는 `SCENT_FAMILY_KEYS` 와 같습니다. */
export const SCENT_FAMILIES: readonly ScentFamilyLabel[] =
  SCENT_FAMILY_KEYS.map((key) => ({
    key,
    adjective: ADJECTIVES[key],
    name: SCENT_FAMILY_NAMES[key],
  }))

const BY_KEY = new Map(SCENT_FAMILIES.map((family) => [family.key, family]))

/** 한 번에 고를 수 있는 계열 수. 두 개를 고르면 나머지 타일은 꺼집니다. */
export const MAX_PICKS = 2

export function scentFamilyLabel(key: ScentFamilyKey): ScentFamilyLabel {
  const found = BY_KEY.get(key)
  if (!found) throw new Error(`알 수 없는 향 계열입니다: ${key}`)
  return found
}

export function familyAdjective(key: ScentFamilyKey): string {
  return scentFamilyLabel(key).adjective
}

/** 낭독기용. 보이는 글자가 호버로 바뀌므로 두 이름을 함께 읽힙니다. */
export function familyAriaLabel(key: ScentFamilyKey): string {
  const { adjective, name } = scentFamilyLabel(key)
  return `${adjective} · ${name}`
}
