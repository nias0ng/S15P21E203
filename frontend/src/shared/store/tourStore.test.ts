import { beforeEach, describe, expect, it } from 'vitest'

import { pickActiveStep, useTourStore } from './tourStore'

const reset = () =>
  useTourStore.setState({ done: [], off: false, wanted: [], active: null })

const state = () => useTourStore.getState()

beforeEach(() => {
  localStorage.clear()
  reset()
})

describe('한 번에 하나', () => {
  it('조건이 맞은 단계가 서고, 끝내면 기다리던 다음 단계가 선다', () => {
    state().want('search', true)
    state().want('results', true)
    expect(state().active).toBe('search')

    state().finish('search')
    expect(state().active).toBe('results')
  })

  it('떠 있는 단계는 차례가 앞선 단계가 뒤늦게 와도 그대로다', () => {
    state().want('results', true)
    state().want('welcome', true)

    expect(state().active).toBe('results')
  })

  it('조건이 풀리면 접고, 다시 맞으면 다시 선다', () => {
    state().want('welcome', true)
    state().want('welcome', false)
    expect(state().active).toBeNull()

    state().want('welcome', true)
    expect(state().active).toBe('welcome')
  })

  it('끝낸 단계는 조건이 다시 맞아도 안 선다', () => {
    state().finish('welcome')
    state().want('welcome', true)

    expect(state().active).toBeNull()
  })
})

describe('앞 단계', () => {
  it('부표 안내는 첫 화면 안내가 끝난 뒤에 선다', () => {
    state().want('welcome', true)
    state().want('buoy', true)
    expect(state().active).toBe('welcome')

    state().finish('welcome')
    expect(state().active).toBe('buoy')
  })

  it('향해 일지는 부표를 알고 카드나 해역을 본 뒤에 선다', () => {
    const base = { active: null, off: false, wanted: ['log' as const] }

    expect(pickActiveStep({ ...base, done: ['welcome', 'buoy'] })).toBeNull()
    expect(pickActiveStep({ ...base, done: ['welcome', 'card'] })).toBeNull()
    expect(pickActiveStep({ ...base, done: ['welcome', 'buoy', 'card'] })).toBe(
      'log',
    )
  })

  it('카드가 끝나면 미니맵이 먼저, 그다음 향해 일지가 선다', () => {
    state().finish('welcome')
    state().finish('buoy')
    state().want('log', true)
    state().want('minimap', true)
    expect(state().active).toBeNull()

    state().finish('card')
    expect(state().active).toBe('minimap')
    state().finish('minimap')
    expect(state().active).toBe('log')
  })

  it('미니맵은 카드 · 해역 가운데 하나만 끝나도 선다', () => {
    const base = { active: null, off: false, wanted: ['minimap' as const] }

    expect(pickActiveStep({ ...base, done: [] })).toBeNull()
    expect(pickActiveStep({ ...base, done: ['zone'] })).toBe('minimap')
  })

  it('배는 미니맵 · 향해 일지가 둘 다 끝나야 선다', () => {
    const base = { active: null, off: false, wanted: ['boat' as const] }

    expect(pickActiveStep({ ...base, done: ['minimap'] })).toBeNull()
    expect(pickActiveStep({ ...base, done: ['minimap', 'log'] })).toBe('boat')
  })
})

describe('끄기 · 다시 보기', () => {
  it('[안내 그만 보기] 뒤로는 아무것도 안 선다', () => {
    state().want('welcome', true)
    state().stop()

    expect(state().active).toBeNull()
    state().want('search', true)
    expect(state().active).toBeNull()
  })

  it('처음부터 다시 보면 끝낸 단계 · 끄기를 풀고 지금 맞는 단계를 세운다', () => {
    state().want('welcome', true)
    state().finish('welcome')
    state().stop()

    state().restart()
    expect(state().done).toEqual([])
    expect(state().active).toBe('welcome')
  })

  it('결과창을 닫는 길은 떠 있던 단계만 끝낸다', () => {
    state().finishIfActive('results')
    expect(state().done).toEqual([])

    state().want('results', true)
    state().finishIfActive('results')
    expect(state().done).toEqual(['results'])
  })
})

it('끝낸 단계 · 끄기만 이 브라우저에 남긴다', () => {
  state().want('welcome', true)
  state().finish('welcome')

  const saved = JSON.parse(localStorage.getItem('hyanghae-tour') ?? '{}')
  expect(saved.state).toEqual({ done: ['welcome'], off: false })
})
