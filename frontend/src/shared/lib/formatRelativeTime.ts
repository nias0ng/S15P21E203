import { i18n } from '@/shared/i18n'

const formatters = new Map<string, Intl.RelativeTimeFormat>()

// 언어마다 한 번만 만듭니다 — 목록의 줄마다 부르는 함수라 매번 만들면 아깝습니다
function formatterFor(language: string) {
  let formatter = formatters.get(language)
  if (!formatter) {
    // NOTE: numeric 이 'auto' 면 -1일이 "어제" 가 되는데, 표기는 "2일 전" 꼴로 통일합니다
    formatter = new Intl.RelativeTimeFormat(language, { numeric: 'always' })
    formatters.set(language, formatter)
  }
  return formatter
}

const UNITS = [
  { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: 'day', ms: 1000 * 60 * 60 * 24 },
  { unit: 'hour', ms: 1000 * 60 * 60 },
  { unit: 'minute', ms: 1000 * 60 },
] as const satisfies readonly {
  unit: Intl.RelativeTimeFormatUnit
  ms: number
}[]

/**
 * 지난 시각을 "12분 전" 꼴로 적습니다. 언어는 부를 때의 화면 언어를 따릅니다.
 *
 * @param iso 시각 문자열
 * @param now 기준 시각. 테스트가 넘깁니다
 * @returns 1분이 안 되면 "방금" · "just now". 읽을 수 없는 시각이면 빈 문자열
 */
export function formatRelativeTime(iso: string, now: Date = new Date()) {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return ''

  const diff = target.getTime() - now.getTime()
  const abs = Math.abs(diff)

  for (const { unit, ms } of UNITS) {
    if (abs >= ms) {
      return formatterFor(i18n.language).format(Math.round(diff / ms), unit)
    }
  }

  return i18n.t('common:time.justNow')
}
