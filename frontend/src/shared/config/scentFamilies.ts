/**
 * 향 계열 아홉 개. 배열 순서는 '가벼운 향에서 무거운 향'

 * NOTE: 키는 백엔드 `scent_regions.code` 이고 3D 엔진의 `scent_map.json` 도 같은 값을 씁니다.
 * 셋이 함께 바뀌어야 합니다.
 */
export const SCENT_FAMILY_KEYS = [
  'FLORAL',
  'GREEN',
  'CITRUS',
  'FRUITY',
  'AQUATIC',
  'MUSK',
  'GOURMAND',
  'WOODY',
  'AMBER',
] as const

export type ScentFamilyKey = (typeof SCENT_FAMILY_KEYS)[number]

export const SCENT_FAMILY_NAMES: Record<ScentFamilyKey, string> = {
  FLORAL: '플로럴',
  GREEN: '그린',
  CITRUS: '시트러스',
  FRUITY: '프루티',
  AQUATIC: '아쿠아틱',
  MUSK: '머스크',
  GOURMAND: '구르망',
  WOODY: '우디',
  AMBER: '앰버',
}

export function isScentFamilyKey(value: unknown): value is ScentFamilyKey {
  return (
    typeof value === 'string' &&
    (SCENT_FAMILY_KEYS as readonly string[]).includes(value)
  )
}

export function toScentFamilyKey(value: unknown): ScentFamilyKey | null {
  return isScentFamilyKey(value) ? value : null
}

export function scentFamilyName(value: unknown): string | null {
  return isScentFamilyKey(value) ? SCENT_FAMILY_NAMES[value] : null
}
