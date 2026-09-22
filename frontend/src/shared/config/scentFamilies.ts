/**
 * 향 계열 아홉 개. 배열 순서는 **가벼운 향에서 무거운 향으로** — 취향 테스트의
 * 3×3 타일이 이 순서로 섭니다.
 *
 * NOTE: 키는 백엔드 `scent_regions.code` 이고 3D 엔진의 `scent_map.json` 도 같은
 * 값을 씁니다. 셋이 함께 바뀌어야 합니다.
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

/** 계열 이름. 응답을 기다리지 않고 그릴 수 있어야 해서 화면 쪽에도 둡니다 */
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

/**
 * 백엔드가 보낸 문자열이 아는 계열인지 봅니다. 응답의 계열은 열린 문자열이라 그대로
 * 믿으면 `undefined` 가 화면에 나옵니다.
 *
 * @param value 백엔드가 준 값
 * @returns 아는 계열이면 `true`
 */
export function isScentFamilyKey(value: unknown): value is ScentFamilyKey {
  return (
    typeof value === 'string' &&
    (SCENT_FAMILY_KEYS as readonly string[]).includes(value)
  )
}

/**
 * @param value 백엔드가 준 값
 * @returns 아는 계열, 모르면 `null` — **버리지 않고 "계열 없음" 으로 다룹니다.**
 *   향수 자체는 보여 줘야 합니다
 */
export function toScentFamilyKey(value: unknown): ScentFamilyKey | null {
  return isScentFamilyKey(value) ? value : null
}

/**
 * @param value 백엔드가 준 값
 * @returns 계열 이름, 모르면 `null`
 */
export function scentFamilyName(value: unknown): string | null {
  return isScentFamilyKey(value) ? SCENT_FAMILY_NAMES[value] : null
}
