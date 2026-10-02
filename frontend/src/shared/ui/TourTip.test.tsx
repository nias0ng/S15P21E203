import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TourTip } from './TourTip'

describe('TourTip', () => {
  it('뜨는 순간 읽히는 한 줄이다', () => {
    render(
      <TourTip onClose={vi.fn()} onStopAll={vi.fn()}>
        부표를 눌러 보세요
      </TourTip>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('부표를 눌러 보세요')
  })

  it('[×] 는 이 안내만, [안내 그만 보기] 는 남은 안내를 끈다', async () => {
    const onClose = vi.fn()
    const onStopAll = vi.fn()
    render(
      <TourTip onClose={onClose} onStopAll={onStopAll}>
        부표를 눌러 보세요
      </TourTip>,
    )

    await userEvent.click(screen.getByRole('button', { name: '안내 닫기' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onStopAll).not.toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole('button', { name: '안내 그만 보기' }),
    )
    expect(onStopAll).toHaveBeenCalledOnce()
  })

  it('누르는 순간 초점을 옮기지 않는다 — 입력칸 밑의 안내가 먼저 접히지 않게', async () => {
    render(
      <>
        <input aria-label="검색" />
        <TourTip onClose={vi.fn()} onStopAll={vi.fn()}>
          안내
        </TourTip>
      </>,
    )
    const input = screen.getByRole('textbox', { name: '검색' })
    input.focus()

    await userEvent.click(screen.getByRole('button', { name: '안내 닫기' }))
    expect(input).toHaveFocus()
  })
})
