import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SceneSearchBar } from './SceneSearchBar'

describe('SceneSearchBar', () => {
  // '자연어' 는 만든 사람의 말이라 처음 온 사람이 아는 향수 이름을 넣었습니다 (지인 피드백 F1)
  it('방식 이름이 무엇으로 찾는지를 말한다', () => {
    render(
      <SceneSearchBar mode="nl" onModeChange={vi.fn()} onSearch={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: '느낌으로' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '이름으로' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.queryByText('자연어')).not.toBeInTheDocument()
  })

  it('입력 전에 적을 말의 예시를 보여 준다', () => {
    render(
      <SceneSearchBar mode="nl" onModeChange={vi.fn()} onSearch={vi.fn()} />,
    )

    expect(
      screen.getByPlaceholderText('예) 상큼한 향, 풀향'),
    ).toBeInTheDocument()
  })

  it('다른 방식을 누르면 그 방식으로 바꾼다', async () => {
    const onModeChange = vi.fn()
    render(
      <SceneSearchBar
        mode="nl"
        onModeChange={onModeChange}
        onSearch={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '이름으로' }))

    expect(onModeChange).toHaveBeenCalledWith('normal')
  })
})
