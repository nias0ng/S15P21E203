import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneSearchBar, type SceneSearchMode } from './SceneSearchBar'

const HINT = '느낌 · 상황을 말로 적으면 어울리는 향수를 추천해 드립니다'

function Bar({
  onSearch = vi.fn(),
  onBrowsePopular,
  introduce = false,
  startMode = 'nl',
}: {
  onSearch?: (keyword: string, mode: SceneSearchMode) => void
  onBrowsePopular?: () => void
  introduce?: boolean
  startMode?: SceneSearchMode
}) {
  const [mode, setMode] = useState<SceneSearchMode>(startMode)
  return (
    <SceneSearchBar
      mode={mode}
      onModeChange={setMode}
      onSearch={onSearch}
      onBrowsePopular={onBrowsePopular}
      introduce={introduce}
    />
  )
}

/** 설명줄을 밀어 올리고 내리는 겹 — `translate-y-0` 이 붙으면 나와 있는 것입니다 */
const hintLayer = () => screen.getByText(HINT).parentElement!

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

/*
  처음 온 사람은 무엇을 적어야 할지 몰랐고, 실패 화면의 예시는 눌러지지도 않았습니다
  (메인 사용성 테스트 2026-10-01). 빈 검색창을 누르면 눌러서 바로 찾는 문장이 펼쳐집니다.
*/
describe('시작 문장', () => {
  it('빈 검색창에 초점이 오면 펼쳐지고, 누르면 그 말로 찾는다', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<Bar onSearch={onSearch} />)

    await user.click(screen.getByRole('searchbox'))
    const starters = screen.getByRole('group', { name: '이렇게 찾아 보세요' })
    expect(starters).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '비 온 뒤 흙냄새' }))

    expect(onSearch).toHaveBeenCalledWith('비 온 뒤 흙냄새', 'nl')
    expect(screen.getByRole('searchbox')).toHaveValue('비 온 뒤 흙냄새')
  })

  it('무엇을 적기 시작하면 접는다', async () => {
    const user = userEvent.setup()
    render(<Bar />)

    await user.click(screen.getByRole('searchbox'))
    await user.keyboard('향')

    expect(
      screen.queryByRole('group', { name: '이렇게 찾아 보세요' }),
    ).not.toBeInTheDocument()
  })

  it('이름 방식이면 지도에 많은 브랜드를 내놓는다', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<Bar onSearch={onSearch} startMode="normal" />)

    await user.click(screen.getByRole('searchbox'))
    await user.click(screen.getByRole('button', { name: '샤넬' }))

    expect(onSearch).toHaveBeenCalledWith('샤넬', 'normal')
  })

  it('[요즘 인기 향수 보기] 는 화면이 고른 길로 보낸다', async () => {
    const user = userEvent.setup()
    const onBrowsePopular = vi.fn()
    render(<Bar onBrowsePopular={onBrowsePopular} />)

    await user.click(screen.getByRole('searchbox'))
    await user.click(
      screen.getByRole('button', { name: /요즘 인기 향수 보기/ }),
    )

    expect(onBrowsePopular).toHaveBeenCalledOnce()
  })
})

/*
  설명줄은 평소 숨어 있다가 마우스를 올릴 때 나옵니다(2026-09-20). 처음 온 사람은 손을 올릴 까닭이
  없어 이 사이트가 무엇을 해 주는지 못 봤습니다 — 이 브라우저에서 처음 한 번만 몇 초 펴 보입니다.
*/
describe('첫 소개', () => {
  it('처음 한 번만 몇 초 펴 두었다가 접는다', () => {
    vi.useFakeTimers()
    const first = render(<Bar introduce />)

    expect(hintLayer()).toHaveClass('translate-y-0')
    act(() => vi.advanceTimersByTime(5000))
    expect(hintLayer()).not.toHaveClass('translate-y-0')

    first.unmount()
    render(<Bar introduce />)
    expect(hintLayer()).not.toHaveClass('translate-y-0')
  })

  it('화면이 아직 소개할 때가 아니면 기다린다', () => {
    render(<Bar introduce={false} />)

    expect(hintLayer()).not.toHaveClass('translate-y-0')
    expect(localStorage.getItem('hyanghae-search-intro')).toBeNull()
  })
})

// '자연어' 는 만든 사람의 말이라 처음 온 사람이 아는 향수 이름을 넣었습니다 (지인 피드백 F1)
describe('방식 이름', () => {
  it('무엇으로 찾는지를 말한다', () => {
    render(<Bar />)

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
    render(<Bar />)

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
