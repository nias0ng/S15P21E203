import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from './formatRelativeTime'

const NOW = new Date('2026-09-08T12:00:00Z')

describe('formatRelativeTime', () => {
  it('1분 미만은 "방금"', () => {
    expect(formatRelativeTime('2026-09-08T11:59:30Z', NOW)).toBe('방금')
  })

  it('와이어프레임 표기대로 "N일 전" 형태를 쓴다', () => {
    expect(formatRelativeTime('2026-09-08T11:48:00Z', NOW)).toBe('12분 전')
    expect(formatRelativeTime('2026-09-08T09:00:00Z', NOW)).toBe('3시간 전')
    // numeric: 'auto' 였다면 "어제" · "그저께" 가 나옵니다
    expect(formatRelativeTime('2026-09-07T12:00:00Z', NOW)).toBe('1일 전')
    expect(formatRelativeTime('2026-09-06T12:00:00Z', NOW)).toBe('2일 전')
  })

  it('잘못된 날짜는 빈 문자열', () => {
    expect(formatRelativeTime('nope', NOW)).toBe('')
  })
})
