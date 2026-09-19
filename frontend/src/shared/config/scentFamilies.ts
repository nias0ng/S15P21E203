/**
 * 향 계열 아홉 개 — 취향 테스트 · 향 지도 · 향수 검색이 같이 쓰는 공용 어휘라
 * `shared/` 에 한 벌만 둡니다(도메인에 두면 반드시 두 벌이 됩니다).
 *
 * **키는 백엔드 `scent_regions.code` 그대로입니다.** 마이그레이션 V6 이 긴 이름을
 * 줄여(`GREEN_AROMATIC` → `GREEN` 등) 지금은 아래 아홉이 전부이고, 3D 엔진의
 * `landing/data/scent_map.json` 도 같은 키를 씁니다.
 *
 * 배열 순서는 **가벼운 향에서 무거운 향으로** — 취향 테스트 3×3 타일이 이 순서입니다.
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

/**
 * 계열 이름. 백엔드도 `scent_regions.name` 으로 주지만 응답을 기다리지 않고 그릴 수
 * 있어야 해서 여기에도 둡니다. 세 계열은 백엔드 쪽 이름이 더 깁니다.
 */
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
 * 백엔드가 보낸 문자열이 우리가 아는 계열인지 확인합니다. 응답의 계열은 열린
 * 문자열이라 그대로 믿으면 `undefined` 가 화면에 나옵니다. **모르는 값은 버리는 게
 * 아니라 "계열 없음" 으로 다룹니다** — 향수 자체는 보여 줘야 합니다.
 */
export function isScentFamilyKey(value: unknown): value is ScentFamilyKey {
  return (
    typeof value === 'string' &&
    (SCENT_FAMILY_KEYS as readonly string[]).includes(value)
  )
}

/** 모르는 값이면 `null` 입니다. 화면은 계열 배지를 그리지 않으면 됩니다. */
export function toScentFamilyKey(value: unknown): ScentFamilyKey | null {
  return isScentFamilyKey(value) ? value : null
}

/** 계열 이름. 모르는 값이면 `null` 입니다. */
export function scentFamilyName(value: unknown): string | null {
  return isScentFamilyKey(value) ? SCENT_FAMILY_NAMES[value] : null
}
