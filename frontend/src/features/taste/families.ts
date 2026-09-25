import { SCENT_FAMILY_NAMES } from '@/shared/config/scentFamilies'

import {
  SCENT_FAMILY_KEYS,
  type ScentFamilyKey,
  type ScentFamilyLabel,
} from './types'

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

export const SCENT_FAMILIES: readonly ScentFamilyLabel[] =
  SCENT_FAMILY_KEYS.map((key) => ({
    key,
    adjective: ADJECTIVES[key],
    name: SCENT_FAMILY_NAMES[key],
  }))

const BY_KEY = new Map(SCENT_FAMILIES.map((family) => [family.key, family]))

export const MAX_PICKS = 2

export function scentFamilyLabel(key: ScentFamilyKey): ScentFamilyLabel {
  const found = BY_KEY.get(key)
  if (!found) throw new Error(`알 수 없는 향 계열입니다: ${key}`)
  return found
}

export function familyAdjective(key: ScentFamilyKey): string {
  return scentFamilyLabel(key).adjective
}

export function familyAriaLabel(key: ScentFamilyKey): string {
  const { adjective, name } = scentFamilyLabel(key)
  return `${adjective} · ${name}`
}
