import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSceneCardStore } from '@/shared/store/sceneCardStore'

import { FeedbackButton } from './FeedbackButton'

const NAME = '의견 보내기 (새 탭에서 설문이 열립니다)'
const GREETING = '의견을 들려주세요 · 새 탭에서 설문이 열립니다'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <FeedbackButton />
    </MemoryRouter>,
  )

const bubble = () => screen.getByText(GREETING).closest('p')

beforeEach(() => {
  sessionStorage.clear()
  useSceneCardStore.setState({ open: false })
})
afterEach(() => vi.useRealTimers())

describe('FeedbackButton', () => {
  it('피드백 폼을 새 탭으로 여는 링크다', () => {
    renderAt('/perfumes')

    const link = screen.getByRole('link', { name: NAME })
    expect(link).toHaveAttribute('href', 'https://forms.gle/mDvTFiY3H9Xew42K7')
    expect(link).toHaveAttribute('target', '_blank')
  })

  /*
    예전에는 화면을 옮길 때마다 4초씩 떠 보던 글을 덮었습니다 (사용성 테스트 2026-10-01).
    한 번 보여 주면 이 탭에서는 다시 혼자 뜨지 않습니다.
  */
  it('말풍선은 이 탭에서 한 번만 혼자 뜬다', () => {
    vi.useFakeTimers()
    const first = renderAt('/perfumes')

    expect(bubble()).not.toHaveClass('invisible')
    act(() => vi.advanceTimersByTime(4000))
    expect(bubble()).toHaveClass('invisible')

    first.unmount()
    renderAt('/brands')
    expect(bubble()).toHaveClass('invisible')
  })

  // 큰 동그라미가 엔진의 해역 진입 글자('01 … ZONE')를 가렸습니다
  it('메인(3D)에서는 작게 선다', () => {
    renderAt('/')

    expect(screen.getByRole('link', { name: NAME })).toHaveClass('size-12')
  })

  // 좁은 화면에서 카드 아랫단('이 향의 해역으로')을 덮었습니다 (사용성 테스트 · 모바일)
  it('메인에서 향수 카드가 떠 있으면 좁은 화면에서 비킨다', () => {
    useSceneCardStore.setState({ open: true })
    renderAt('/')

    expect(screen.getByRole('link', { name: NAME }).parentElement).toHaveClass(
      'max-[940px]:invisible',
    )
  })

  it('다른 화면에서는 카드와 상관없이 그대로 선다', () => {
    useSceneCardStore.setState({ open: true })
    renderAt('/perfumes')

    expect(
      screen.getByRole('link', { name: NAME }).parentElement,
    ).not.toHaveClass('max-[940px]:invisible')
  })
})
