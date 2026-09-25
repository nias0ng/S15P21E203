import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { StarRating } from './StarRating'

/**
 * 백엔드가 1.0~5.0 을 0.5 단위로 받습니다(`@DecimalMin("1.0") @DecimalMax("5.0")`).
 * 예전에는 정수만 받았고 소수가 오면 조용히 잘려 원이 모자라게 그려졌습니다.
 */
describe('StarRating', () => {
  it('고를 수 있는 값이 아홉 개다 — 0.5 는 백엔드가 안 받아 빠진다', () => {
    render(<StarRating label="적합도" value={null} onChange={vi.fn()} />)

    const options = screen.getAllByRole('radio')
    expect(options).toHaveLength(9)
    expect(options[0]).toHaveAccessibleName('5점 중 1점')
    expect(options[8]).toHaveAccessibleName('5점 중 5점')
    expect(
      screen.queryByRole('radio', { name: '5점 중 0.5점' }),
    ).not.toBeInTheDocument()
  })

  it('반 단위 값을 고를 수 있다', async () => {
    const onChange = vi.fn()
    render(<StarRating label="적합도" value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: '5점 중 4.5점' }))

    expect(onChange).toHaveBeenCalledWith(4.5)
  })

  it('지금 값에 체크가 들어간다', () => {
    render(<StarRating label="적합도" value={4.5} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { checked: true })).toHaveAccessibleName(
      '5점 중 4.5점',
    )
  })

  it('화살표 키로 0.5씩 움직인다', async () => {
    const onChange = vi.fn()
    render(<StarRating label="적합도" value={3} onChange={onChange} />)

    screen.getByRole('radio', { name: '5점 중 3점' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith(3.5)

    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith(2.5)
  })

  it('양 끝에서는 더 나가지 않는다', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <StarRating label="적합도" value={1} onChange={onChange} />,
    )

    screen.getByRole('radio', { name: '5점 중 1점' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith(1)

    rerender(<StarRating label="적합도" value={5} onChange={onChange} />)
    screen.getByRole('radio', { name: '5점 중 5점' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  it('아직 안 매긴 값은 숫자 대신 말로 알린다', () => {
    render(<StarRating label="적합도" value={null} onChange={vi.fn()} />)

    expect(screen.getByText('아직 매기지 않음')).toBeInTheDocument()
  })
})
