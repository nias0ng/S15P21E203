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

  it('안내 어디를 눌러도 · [다음 →] 을 눌러도 다음으로 넘긴다 — [×] 는 넘기지 않는다', async () => {
    const onNext = vi.fn()
    const onClose = vi.fn()
    render(
      <TourTip onClose={onClose} onStopAll={vi.fn()} onNext={onNext}>
        부표를 눌러 보세요
      </TourTip>,
    )

    await userEvent.click(screen.getByText('부표를 눌러 보세요'))
    await userEvent.click(screen.getByRole('button', { name: '다음 →' }))
    expect(onNext).toHaveBeenCalledTimes(2)

    await userEvent.click(screen.getByRole('button', { name: '안내 닫기' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('넘길 곳이 없으면 [다음 →] 이 없다', () => {
    render(
      <TourTip onClose={vi.fn()} onStopAll={vi.fn()}>
        안내
      </TourTip>,
    )

    expect(
      screen.queryByRole('button', { name: '다음 →' }),
    ).not.toBeInTheDocument()
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
