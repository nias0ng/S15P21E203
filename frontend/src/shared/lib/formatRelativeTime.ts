/** "3시간 전" 처럼 상대 시간 문자열을 만듭니다 (A12 · A22 · A23 공통 표기) */
// numeric: 'always' — 'auto' 면 -1일이 "어제" 가 되는데 표기는 "2일 전" 형태입니다
const formatter = new Intl.RelativeTimeFormat('ko', { numeric: 'always' })

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

export function formatRelativeTime(
  iso: string,
  /** 테스트에서 현재 시각을 고정하기 위한 인자입니다. */
  now: Date = new Date(),
) {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return ''

  const diff = target.getTime() - now.getTime()
  const abs = Math.abs(diff)

  for (const { unit, ms } of UNITS) {
    if (abs >= ms) {
      return formatter.format(Math.round(diff / ms), unit)
    }
  }

  // 1분 미만은 "방금" 으로 통일합니다
  return '방금'
}
