/**
 * 향 계열 아홉 개 — 앱 전체의 공용 어휘
 *
 * 세 도메인이 같은 값을 씁니다. 취향 테스트는 이 중 1~2개를 고르게 하고, 향 지도는
 * 지도를 이 아홉으로 나누며, 향수 검색은 대표 계열 하나를 내려줍니다. 그래서 어느
 * 도메인에도 두지 않고 `shared/` 에 한 벌만 둡니다 — `features/a` 는 `features/b` 를
 * import 할 수 없어, 도메인에 두면 반드시 두 벌이 되고 언젠가 어긋납니다.
 *
 * **키는 백엔드 `scent_regions.code` 그대로입니다.** 마이그레이션 V6 이 긴 이름을
 * 짧게 줄여(`GREEN_AROMATIC` → `GREEN`, `AMBER_SPICY` → `AMBER`,
 * `MUSK_POWDERY` → `MUSK`) 지금은 아래 아홉이 전부입니다. 3D 엔진의
 * `landing/data/scent_map.json` 도 같은 키를 씁니다.
 *
 * 배열 순서는 **가벼운 향에서 무거운 향으로** 내려갑니다. 취향 테스트 타일 3×3
 * 그리드가 이 순서를 그대로 씁니다.
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
 * 계열 이름. 백엔드도 `scent_regions.name` 으로 같은 것을 내려주지만, 화면이 서버
 * 응답을 기다리지 않고 바로 글자를 그릴 수 있어야 해서 여기에도 둡니다.
 *
 * 세 계열은 백엔드 쪽 이름이 더 깁니다(그린·아로마틱 · 앰버·스파이시 ·
 * 머스크·파우더리). 화면에서는 가운뎃점 뒤가 줄바꿈을 만들어 짧은 쪽을 씁니다.
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
 * 백엔드가 보낸 문자열이 우리가 아는 계열인지 확인합니다.
 *
 * 응답의 계열은 열린 문자열입니다 — `scent_regions` 에 행을 더하면 여기 없는 값이
 * 옵니다. 그대로 믿고 이름표를 찾으면 `undefined` 가 화면에 나오므로, 받는 자리에서
 * 한 번 거릅니다. **모르는 값은 버리는 것이 아니라 "계열 없음" 으로 다룹니다** —
 * 향수 자체는 보여 줘야 합니다.
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
