import { afterEach, describe, expect, it } from 'vitest'

import { isGraphicsMode, useGraphicsStore } from './graphicsStore'

const KEY = 'hyanghae-graphics'

afterEach(() => {
  useGraphicsStore.setState({ mode: 'auto', told: [], quality: null })
  localStorage.clear()
})

describe('isGraphicsMode', () => {
  it('다섯 가지 모드만 받습니다', () => {
    expect(['auto', 'high', 'mid', 'low', 'min'].every(isGraphicsMode)).toBe(
      true,
    )
    expect(isGraphicsMode('ultra')).toBe(false)
    expect(isGraphicsMode(undefined)).toBe(false)
  })
})

describe('useGraphicsStore', () => {
  it('사람이 고른 설정은 남기고, 엔진의 지금 단계는 남기지 않습니다', () => {
    useGraphicsStore.getState().setMode('low')
    useGraphicsStore.getState().setQuality({
      mode: 'low',
      tier: 'low',
      reason: 'user',
      gpuClass: 'integrated',
    })

    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as {
      state?: Record<string, unknown>
    }
    expect(saved.state).toEqual({ mode: 'low', told: [], calm: false })
  })

  it('저장소의 모드를 모르면 자동으로 돌아갑니다', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ state: { mode: 'ultra', told: ['down'] }, version: 1 }),
    )

    await useGraphicsStore.persist.rehydrate()

    expect(useGraphicsStore.getState().mode).toBe('auto')
    expect(useGraphicsStore.getState().told).toEqual(['down'])
  })
})
