import { i18n } from '@/shared/i18n'

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

const nameOf = (key: ScentFamilyKey) =>
  i18n.t(`common:scentFamily.${key.toLowerCase() as Lowercase<ScentFamilyKey>}`)

/**
 * 계열 이름표. 값은 **읽을 때의** 화면 언어로 풉니다(번역 묶음 common 의 scentFamily).
 *
 * NOTE: 모듈이 읽힐 때 이 값을 옮겨 담아 두면 언어를 바꿔도 그 언어로 남습니다 — 그릴 때 읽으세요.
 */
export const SCENT_FAMILY_NAMES: Readonly<Record<ScentFamilyKey, string>> =
  Object.defineProperties(
    {} as Record<ScentFamilyKey, string>,
    Object.fromEntries(
      SCENT_FAMILY_KEYS.map((key) => [
        key,
        { get: () => nameOf(key), enumerable: true },
      ]),
    ),
  )

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
  return isScentFamilyKey(value) ? nameOf(value) : null
}
