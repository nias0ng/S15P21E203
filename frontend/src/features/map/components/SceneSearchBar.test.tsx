import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTourStore } from '@/shared/store/tourStore'

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

const WELCOME =
  '향수를 향 계열별로 펼친 바다예요. 원하는 느낌을 적거나, 떠 있는 부표를 눌러 보세요.'
const SEARCH_TIP = "'자연어'는 느낌을 문장으로, '이름'은 아는 향수를 찾아요."

beforeEach(() => {
  localStorage.clear()
  useTourStore.setState({ done: [], off: false, wanted: [], active: null })
})

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
  첫 방문 안내 두 단계가 설명줄 자리에 섭니다. 처음 온 사람은 설명줄을 볼 까닭이 없어 이 사이트가
  무엇을 해 주는지 못 봤고, 왼쪽 칸이 검색 방식을 바꾸는 단추인 줄도 몰랐습니다 (메인 사용성 테스트).
*/
describe('첫 방문 안내', () => {
  it('화면이 비면 검색창 아래에 첫 화면 안내가 선다', () => {
    render(<Bar introduce />)

    expect(screen.getByRole('status')).toHaveTextContent(WELCOME)
    // 설명줄은 화면에서만 걷습니다 — 입력칸의 설명으로는 그대로 읽힙니다
    expect(screen.getByRole('searchbox')).toHaveAccessibleDescription(HINT)
  })

  it('화면이 아직 비지 않았으면 기다린다', () => {
    render(<Bar introduce={false} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('검색창을 누르면 첫 화면 안내가 끝나고 검색 방식 안내로 바뀐다', async () => {
    const user = userEvent.setup()
    render(<Bar introduce />)

    await user.click(screen.getByRole('searchbox'))

    expect(screen.getByRole('status')).toHaveTextContent(SEARCH_TIP)
    expect(useTourStore.getState().done).toContain('welcome')
  })

  it('첫 검색으로 검색 방식 안내가 끝난다', async () => {
    const user = userEvent.setup()
    render(<Bar />)

    await user.click(screen.getByRole('searchbox'))
    await user.keyboard('비 오는 날{Enter}')

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(useTourStore.getState().done).toContain('search')
  })

  it('[×] 를 눌러도 입력칸 초점과 시작 문장은 그대로다', async () => {
    const user = userEvent.setup()
    render(<Bar />)

    await user.click(screen.getByRole('searchbox'))
    await user.click(screen.getByRole('button', { name: '안내 닫기' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveFocus()
    expect(
      screen.getByRole('group', { name: '이렇게 찾아 보세요' }),
    ).toBeInTheDocument()
  })

  it('끝낸 안내는 다음 방문에 다시 서지 않는다', async () => {
    const user = userEvent.setup()
    const first = render(<Bar introduce />)
    await user.click(screen.getByRole('button', { name: '안내 닫기' }))
    first.unmount()

    render(<Bar introduce />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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
