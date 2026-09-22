import {
  SCENT_FAMILY_KEYS,
  type ScentFamilyKey,
  type ScentFamilyLabel,
} from './types'

/** 계열 9개의 화면 문구. 배열 순서는 `SCENT_FAMILY_KEYS` 와 같습니다. */
export const SCENT_FAMILIES: readonly ScentFamilyLabel[] = [
  { key: 'FLORAL', adjective: '화사한', name: '플로럴' },
  { key: 'GREEN', adjective: '싱그러운', name: '그린' },
  { key: 'CITRUS', adjective: '상큼한', name: '시트러스' },
  { key: 'FRUITY', adjective: '발랄한', name: '프루티' },
  { key: 'AQUATIC', adjective: '시원한', name: '아쿠아틱' },
  { key: 'MUSK', adjective: '포근한', name: '머스크' },
  { key: 'GOURMAND', adjective: '달콤한', name: '구르망' },
  { key: 'WOODY', adjective: '차분한', name: '우디' },
  { key: 'AMBER', adjective: '따뜻한', name: '앰버' },
]

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

// 계열이 늘어나면 화면이 아니라 여기서 먼저 터지게 합니다.
if (SCENT_FAMILIES.length !== SCENT_FAMILY_KEYS.length) {
  throw new Error('SCENT_FAMILIES 가 SCENT_FAMILY_KEYS 를 전부 덮지 않습니다')
}
