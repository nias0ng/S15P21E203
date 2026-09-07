/**
 * "3시간 전" 처럼 상대 시간 문자열을 만듭니다.
 * 와이어프레임 A12 · A22a · A22b · A23 이 모두 이 표기를 씁니다.
 *
 * 브라우저 기본 Intl.RelativeTimeFormat 을 씁니다. 직접 계산하면 단수/복수와
 * 언어별 표현을 손으로 관리해야 합니다.
 *
 * 훅을 쓰지 않는 순수 함수라 shared/lib 에 둡니다(렌더링 없이 테스트 가능).
 */
// numeric: 'always' 를 씁니다. 'auto' 로 두면 -1일이 "어제", -2일이 "그저께" 가 되는데
// 와이어프레임 표기는 "12분 전 · 3시간 전 · 2일 전" 형태입니다.
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
