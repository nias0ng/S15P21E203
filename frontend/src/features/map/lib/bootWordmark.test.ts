import { describe, expect, it } from 'vitest'

import {
  WORDMARK_PARTS,
  wordmarkDrawnAt,
  wordmarkProgress,
  wordmarkTrim,
} from './bootWordmark'

describe('wordmarkTrim', () => {
  it('길이에 비례하되 차이를 눌러 나누고, 전체가 정확히 drawMs 에 끝납니다', () => {
    // lengthPower 1 이면 길이에 그대로 비례합니다
    const raw = wordmarkTrim([100, 200, 100], { drawMs: 1000, lengthPower: 1 })
    expect(raw.map((step) => step.duration)).toEqual([250, 500, 250])
    expect(raw.map((step) => step.delay)).toEqual([0, 250, 750])
    expect(wordmarkDrawnAt(raw)).toBe(1000)

    // 기본값(0.55)은 긴 획이 오래 걸리긴 하되 차이가 줄어듭니다 (사용자 : "왜 밑에 있는게 오래걸리지")
    const eased = wordmarkTrim([100, 200, 100], { drawMs: 1000 })
    expect(wordmarkDrawnAt(eased)).toBeCloseTo(1000, 6)
    expect(eased[1]!.duration).toBeGreaterThan(eased[0]!.duration)
    expect(eased[1]!.duration / eased[0]!.duration).toBeLessThan(2)
  })

  it('획 사이의 숨도 그리는 시간 안에 들어갑니다', () => {
    const steps = wordmarkTrim([100, 100], { drawMs: 1000, strokeGapMs: 100 })
    expect(steps[0]).toEqual({ delay: 0, duration: 450 })
    expect(steps[1]).toEqual({ delay: 550, duration: 450 })
    expect(wordmarkDrawnAt(steps)).toBe(1000)
  })

  it('길이를 못 재면(0) 고르게 나눕니다', () => {
    const steps = wordmarkTrim([0, 0], { drawMs: 1000 })
    expect(steps.map((step) => step.duration)).toEqual([500, 500])
  })

  it('획이 없으면 빈 목록입니다', () => {
    expect(wordmarkTrim([], { drawMs: 1000 })).toEqual([])
  })
})

describe('WORDMARK_PARTS (사용자가 그린 SVG)', () => {
  it('획 · 면이 13쌍이고 쓰는 순서입니다 — 향(ㅎ·ㅑ·받침 ㅇ) → 해(ㅎ·ㅐ)', () => {
    expect(WORDMARK_PARTS).toHaveLength(13)
    expect(WORDMARK_PARTS.map((part) => part.name)).toEqual([
      '향 ㅎ 꼭지',
      '향 ㅎ 가로',
      '향 ㅎ 동그라미',
      '향 ㅑ 세로',
      '향 ㅑ 위 가로',
      '향 ㅑ 아래 가로',
      '향 받침 ㅇ',
      '해 ㅎ 꼭지',
      '해 ㅎ 가로',
      '해 ㅎ 동그라미',
      '해 ㅐ 왼 세로',
      '해 ㅐ 가로',
      '해 ㅐ 오른 세로',
    ])
  })

  it('획은 하나의 M 으로 시작하는 한 획이고, 면은 닫혀 있습니다', () => {
    for (const { stroke, outline } of WORDMARK_PARTS) {
      expect(stroke.startsWith('M')).toBe(true)
      // 한 문자열에 획이 여럿이면 순서 · 시간차가 어긋납니다
      expect(stroke.slice(1)).not.toMatch(/[Mm]/)
      expect(outline.startsWith('M')).toBe(true)
      expect(outline.trimEnd().endsWith('Z')).toBe(true)
    }
  })

  it('같은 면 · 같은 획이 두 번 쓰이지 않습니다 (짝이 1:1)', () => {
    expect(new Set(WORDMARK_PARTS.map((part) => part.outline)).size).toBe(13)
    expect(new Set(WORDMARK_PARTS.map((part) => part.stroke)).size).toBe(13)
  })
})

describe('wordmarkProgress (얼마나 그려졌나)', () => {
  const steps = wordmarkTrim([100, 100], { drawMs: 1000 })

  it('그리기 전에는 0, 다 그리면 1 이고 넘어가지 않습니다', () => {
    expect(wordmarkProgress(steps, 0)).toEqual([0, 0])
    expect(wordmarkProgress(steps, 1000)).toEqual([1, 1])
    expect(wordmarkProgress(steps, 5000)).toEqual([1, 1])
  })

  it('쓰는 순서대로 — 앞 획이 다 그려진 뒤에 뒤 획이 나갑니다', () => {
    const half = wordmarkProgress(steps, 250)
    expect(half[0]).toBeGreaterThan(0)
    expect(half[0]).toBeLessThan(1)
    expect(half[1]).toBe(0)
    expect(wordmarkProgress(steps, 500)).toEqual([1, 0])
  })

  it('결이 날카롭습니다 — 획의 한가운데에서 이미 한참 나가 있습니다 (out cubic)', () => {
    // 사용자 : "패스가 진행되는 값을 좀 더 날카롭게" — 사인 인아웃이던 때는 딱 0.5 였습니다
    expect(wordmarkProgress(steps, 250)[0]).toBeCloseTo(0.875, 6)
  })

  it('뒤처지는 겹(lag)은 늦게 나가고, 붓끝이 끝난 뒤에 마저 따라옵니다', () => {
    // lag 0.5 = 그 획 그리는 시간의 절반만큼 뒤
    expect(wordmarkProgress(steps, 250, 0.5)[0]).toBe(0)
    expect(wordmarkProgress(steps, 500, 0.5)[0]).toBeGreaterThan(0)
    expect(wordmarkProgress(steps, 500, 0.5)[0]).toBeLessThan(1)
    // 붓끝은 500ms 에 끝났지만 뒤엣것은 750ms 에야 다 따라옵니다
    expect(wordmarkProgress(steps, 750, 0.5)[0]).toBe(1)
    expect(wordmarkDrawnAt(steps, 0.5)).toBe(1250)
  })

  it('길이를 못 재 그리는 시간이 0 인 획은 제 차례에 한 번에 드러납니다', () => {
    const instant = [{ delay: 100, duration: 0 }]
    expect(wordmarkProgress(instant, 99)).toEqual([0])
    expect(wordmarkProgress(instant, 100)).toEqual([1])
  })
})
