import { describe, expect, it } from 'vitest'

import { formatShelfDate } from './lib'

describe('formatShelfDate', () => {
  it('ISO 문자열을 YYYY.MM.DD 로 적는다', () => {
    // 지역 시간대와 무관하게 같은 날이 되도록 한낮을 씁니다
    expect(formatShelfDate('2026-08-20T12:00:00Z')).toBe('2026.08.20')
  })

  it('한 자리 월과 일에 0 을 채운다', () => {
    expect(formatShelfDate('2026-01-05T12:00:00Z')).toBe('2026.01.05')
  })

  it('메모를 쓴 적이 없으면 null 을 준다', () => {
    expect(formatShelfDate(null)).toBeNull()
  })

  it('날짜로 읽을 수 없는 값에도 화면을 깨뜨리지 않는다', () => {
    expect(formatShelfDate('어제')).toBeNull()
  })
})
