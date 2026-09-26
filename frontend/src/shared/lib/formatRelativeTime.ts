// NOTE: numeric 이 'auto' 면 -1일이 "어제" 가 되는데, 표기는 "2일 전" 꼴로 통일합니다
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

export function formatRelativeTime(iso: string, now: Date = new Date()) {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return ''

  const diff = target.getTime() - now.getTime()
  const abs = Math.abs(diff)

  for (const { unit, ms } of UNITS) {
    if (abs >= ms) {
      return formatter.format(Math.round(diff / ms), unit)
    }
  }

  return '방금'
}
