export type Locale = 'ko' | 'en'

export const LOCALES: readonly Locale[] = ['ko', 'en']

export const DEFAULT_LOCALE: Locale = 'ko'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

/**
 * 처음 온 사람의 언어를 브라우저 설정으로 고릅니다. **가장 앞에 둔 언어**만 봅니다 —
 * 영어를 앞에 두고 한국어를 뒤에 둔 사람은 영어를 더 편하게 읽는 사람입니다.
 *
 * @param languages `navigator.languages` 처럼 선호 순서대로 늘어선 언어 태그
 * @returns 첫 언어가 한국어면 `ko`, 다른 언어면 `en`. 알 수 없으면 `ko`
 */
export function detectLocale(languages: readonly string[]): Locale {
  const first = languages[0]
  if (first === undefined || first === '') return DEFAULT_LOCALE
  return first.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

/**
 * 영어 이름과 한국어 이름을 함께 주는 응답(향수 · 브랜드 · 노트)에서 화면에 쓸 이름을 고릅니다.
 * 영어 화면은 원래 이름(`name`)을, 한국어 화면은 한국어 이름을 쓰되 비어 있으면 원래 이름을 씁니다.
 */
export function localizedName(
  locale: Locale,
  name: string,
  nameKo: string | null | undefined,
): string {
  if (locale === 'en') return name
  return nameKo !== null && nameKo !== undefined && nameKo.trim() !== ''
    ? nameKo
    : name
}

/**
 * 브랜드처럼 원래 이름이 비어 있을 수 있는 칸의 `localizedName`. 원래 이름이 없으면 한국어 이름을,
 * 둘 다 없으면 null 입니다.
 */
export function localizedBrand(
  locale: Locale,
  brand: string | null | undefined,
  brandKo: string | null | undefined,
): string | null {
  if (brand === null || brand === undefined || brand.trim() === '') {
    return brandKo !== null && brandKo !== undefined && brandKo.trim() !== ''
      ? brandKo
      : null
  }
  return localizedName(locale, brand, brandKo)
}
