import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTourStore } from '@/shared/store/tourStore'

import { setTourAnchorSource } from '../lib/tourAnchor'

import { SceneTourTip } from './SceneTourTip'

const watch = vi.fn()

beforeEach(() => {
  localStorage.clear()
  useTourStore.setState({ done: [], off: false, wanted: [], active: null })
  watch.mockReset()
  setTourAnchorSource({
    watch,
    read: () => ({ x: 900, y: 500, w: 80, h: 20, side: 1 }),
  })
})
afterEach(() => {
  setTourAnchorSource(null)
  vi.useRealTimers()
})

describe('SceneTourTip', () => {
  // 자리를 쓰기 전에는 안 보이는 채로 태어나, 엔진이 잰 자리를 읽은 다음 장에 보입니다
  it('제 차례가 오면 엔진에 자리를 재 달라고 하고 안내를 세운다', async () => {
    // 미니맵은 카드 · 해역 안내 뒤에 섭니다
    useTourStore.setState({ done: ['card'] })
    render(
      <SceneTourTip step="minimap" ready placement="aboveEnd">
        향 계열 지도예요
      </SceneTourTip>,
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      '향 계열 지도예요',
    )
    expect(watch).toHaveBeenCalledWith('minimap')
  })

  it('[×] 로 끝내면 접고 엔진에 그만 재라고 한다', async () => {
    useTourStore.setState({ done: ['card'] })
    render(
      <SceneTourTip step="minimap" ready placement="aboveEnd">
        향 계열 지도예요
      </SceneTourTip>,
    )

    await userEvent.click(
      await screen.findByRole('button', { name: '안내 닫기' }),
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(useTourStore.getState().done).toContain('minimap')
    expect(watch).toHaveBeenLastCalledWith(null)
  })

  it('앞 단계가 안 끝났으면 기다린다 — 부표는 첫 화면 안내 뒤', () => {
    render(
      <SceneTourTip step="buoy" ready placement="above">
        부표를 눌러 보세요
      </SceneTourTip>,
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(watch).not.toHaveBeenCalled()
  })

  /*
    카드는 부표를 누르면 향수 고르기로 넘어가며 0.3초 남짓 접혔다 다시 뜹니다 — 그 틈을 닫힘으로 읽으면
    안내가 뜨자마자 끝났습니다 (2026-10-02 실측).
  */
  describe('닫히는 것이 곧 할 일인 단계 (카드 · 해역)', () => {
    function Card({ open }: { open: boolean }) {
      return (
        <SceneTourTip
          step="card"
          ready={open}
          finishOnLeave
          holdMs={800}
          placement="below"
        >
          카드 단추
        </SceneTourTip>
      )
    }

    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setOpen(!open)}>
            토글
          </button>
          <Card open={open} />
        </>
      )
    }

    it('잠깐 접혔다 다시 뜨면 그대로 둔다', () => {
      vi.useFakeTimers()
      render(<Harness />)
      const toggle = screen.getByRole('button', { name: '토글' })

      act(() => toggle.click())
      act(() => vi.advanceTimersByTime(300))
      act(() => toggle.click())
      act(() => vi.advanceTimersByTime(1000))

      expect(screen.getByRole('status')).toHaveTextContent('카드 단추')
      expect(useTourStore.getState().done).not.toContain('card')
    })

    it('닫힌 채로 있으면 본 것으로 친다', () => {
      vi.useFakeTimers()
      render(<Harness />)

      act(() => screen.getByRole('button', { name: '토글' }).click())
      act(() => vi.advanceTimersByTime(800))

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(useTourStore.getState().done).toContain('card')
    })
  })
})
