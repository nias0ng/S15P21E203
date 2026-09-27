import { describe, expect, it } from 'vitest'

import type { SceneQuality } from '@/shared/store/graphicsStore'

import { engineSrc, parseSceneQuality, qualityNotice } from './sceneQuality'

const quality = (over: Partial<SceneQuality> = {}): SceneQuality => ({
  mode: 'auto',
  tier: 'low',
  reason: 'start',
  gpuClass: 'integrated',
  ...over,
})

describe('parseSceneQuality', () => {
  it('엔진이 넘긴 모양을 좁히고 GPU 부류만 꺼냅니다', () => {
    expect(
      parseSceneQuality({
        mode: 'auto',
        tier: 'mid',
        reason: 'up',
        auto: true,
        label: '보통',
        gpu: {
          name: 'ANGLE (Intel, Intel(R) Arc(TM) Graphics)',
          cls: 'integrated',
        },
      }),
    ).toEqual({
      mode: 'auto',
      tier: 'mid',
      reason: 'up',
      gpuClass: 'integrated',
    })
  })

  it('모드나 단계가 모르는 값이면 버립니다', () => {
    expect(parseSceneQuality({ mode: 'ultra', tier: 'high' })).toBeNull()
    expect(parseSceneQuality({ mode: 'auto', tier: 'max' })).toBeNull()
    expect(parseSceneQuality(null)).toBeNull()
    expect(parseSceneQuality('high')).toBeNull()
  })

  it('이유 · GPU 부류가 비거나 낯설면 시작 · 모름으로 읽습니다', () => {
    expect(parseSceneQuality({ mode: 'high', tier: 'high' })).toEqual({
      mode: 'high',
      tier: 'high',
      reason: 'start',
      gpuClass: 'unknown',
    })
    expect(
      parseSceneQuality({
        mode: 'low',
        tier: 'low',
        reason: 'boom',
        gpu: { cls: 'tpu' },
      })?.gpuClass,
    ).toBe('unknown')
  })
})

describe('engineSrc', () => {
  it('자동이면 주소를 그대로 두고, 고정이면 단계를 붙입니다', () => {
    expect(engineSrc('/landing/index.html', 'auto')).toBe('/landing/index.html')
    expect(engineSrc('/landing/index.html', 'mid')).toBe(
      '/landing/index.html?quality=mid',
    )
  })
})

describe('qualityNotice', () => {
  it('내장 그래픽이 자동으로 낮게 시작하면 알립니다', () => {
    expect(qualityNotice(quality())).toBe('startLow')
    expect(qualityNotice(quality({ gpuClass: 'software' }))).toBe('startLow')
  })

  it('외장 그래픽이거나 사람이 고른 낮음이면 시작을 알리지 않습니다', () => {
    expect(qualityNotice(quality({ gpuClass: 'discrete' }))).toBeNull()
    expect(qualityNotice(quality({ mode: 'low' }))).toBeNull()
    expect(qualityNotice(quality({ tier: 'mid' }))).toBeNull()
  })

  it('자동으로 내렸거나 가장 낮은 단계에서도 느리면 알리고, 올린 것은 알리지 않습니다', () => {
    expect(qualityNotice(quality({ reason: 'down', tier: 'mid' }))).toBe('down')
    expect(qualityNotice(quality({ reason: 'slow' }))).toBe('slow')
    expect(qualityNotice(quality({ reason: 'up', tier: 'mid' }))).toBeNull()
    expect(qualityNotice(quality({ reason: 'user' }))).toBeNull()
  })
})
