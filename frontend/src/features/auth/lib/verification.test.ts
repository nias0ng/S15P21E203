import { describe, expect, it } from 'vitest'

import {
  formatCountdown,
  sanitizeVerificationCode,
  secondsUntil,
} from './verification'

describe('formatCountdown', () => {
  it('분과 초를 두 자리로 채운다', () => {
    expect(formatCountdown(300)).toBe('05:00')
    expect(formatCountdown(299)).toBe('04:59')
    expect(formatCountdown(9)).toBe('00:09')
  })

  it('0 이하는 00:00 으로 멈춘다', () => {
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(-3)).toBe('00:00')
  })

  it('소수는 버린다', () => {
    expect(formatCountdown(59.9)).toBe('00:59')
  })
})

describe('secondsUntil', () => {
  it('남은 밀리초를 초로 올림한다', () => {
    expect(secondsUntil(10_000, 0)).toBe(10)
    expect(secondsUntil(10_000, 400)).toBe(10)
    expect(secondsUntil(10_000, 9_001)).toBe(1)
  })

  it('마감이 지나면 0 이다', () => {
    expect(secondsUntil(10_000, 10_000)).toBe(0)
    expect(secondsUntil(10_000, 12_000)).toBe(0)
  })
})

describe('sanitizeVerificationCode', () => {
  it('숫자만 남긴다', () => {
    expect(sanitizeVerificationCode('12a3-4 5')).toBe('12345')
  })

  it('일곱 자리에서 자르고 앞자리 0 을 지킨다', () => {
    expect(sanitizeVerificationCode('0012345678')).toBe('0012345')
  })
})
