import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTourStore } from '@/shared/store/tourStore'

import { SceneSearchBar } from './SceneSearchBar'

const HINT = '느낌 · 상황을 말로 적으면 어울리는 향수를 추천해 드립니다'
const TAG = '느낌·상황'

function Bar({
  onSearch = vi.fn(),
  onBrowsePopular,
  introduce = false,
}: {
  onSearch?: (keyword: string) => void
  onBrowsePopular?: () => void
  introduce?: boolean
}) {
  return (
    <SceneSearchBar
      onSearch={onSearch}
      onBrowsePopular={onBrowsePopular}
      introduce={introduce}
    />
  )
}

const SEARCH_TIP = "'느낌·상황'을 눌러 원하는 느낌이나 상황을 적어 보세요."
const SEARCH_EXAMPLE = '예) 비 온 뒤 흙냄새 · 상큼한 향'

/** 항해 줄기의 앞 단계(바다 · 방향키 · 부표)를 끝낸 사람 */
const sailed = () => useTourStore.setState({ done: ['sea', 'keys', 'buoy'] })

beforeEach(() => {
  localStorage.clear()
  useTourStore.setState({
    done: [],
    off: false,
    wanted: [],
    active: null,
    forced: null,
    touch: false,
  })
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

    expect(onSearch).toHaveBeenCalledWith('비 온 뒤 흙냄새')
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
  첫 방문 안내의 검색 단계가 설명줄 자리에 섭니다. 처음 온 사람은 설명줄을 볼 까닭이 없어 이 칸에 무엇을
  적어야 하는지 몰랐습니다 (메인 사용성 테스트). 항해 줄기(바다 → 방향키 → 부표 → 닮은 향수)를 배운 뒤에 섭니다.
*/
describe('첫 방문 안내', () => {
  it('앞 단계를 배운 뒤 화면이 비면 검색창 아래에 예시와 함께 선다', () => {
    sailed()
    render(<Bar introduce />)

    const tip = screen.getByRole('status')
    expect(tip).toHaveTextContent(SEARCH_TIP)
    expect(tip).toHaveTextContent(SEARCH_EXAMPLE)
    // 설명줄은 화면에서만 걷습니다 — 입력칸의 설명으로는 그대로 읽힙니다
    expect(screen.getByRole('searchbox')).toHaveAccessibleDescription(HINT)
  })

  it('바다 누르기부터 배우기 전에는 기다린다', async () => {
    const user = userEvent.setup()
    render(<Bar introduce />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    // 먼저 검색창을 누른 사람에게도 차례를 건너뛰어 서지 않습니다 — 시작 문장은 그대로 펼쳐집니다
    await user.click(screen.getByRole('searchbox'))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: '이렇게 찾아 보세요' }),
    ).toBeInTheDocument()
  })

  it('화면이 아직 비지 않았으면 기다린다', () => {
    sailed()
    render(<Bar introduce={false} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('첫 검색으로 검색 안내가 끝난다', async () => {
    const user = userEvent.setup()
    sailed()
    render(<Bar introduce />)

    await user.click(screen.getByRole('searchbox'))
    await user.keyboard('비 오는 날{Enter}')

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(useTourStore.getState().done).toContain('search')
  })

  it('차례 전에 먼저 찾아 본 사람에게는 검색 안내가 서지 않는다', async () => {
    const user = userEvent.setup()
    const first = render(<Bar introduce />)
    await user.click(screen.getByRole('searchbox'))
    await user.keyboard('비 오는 날{Enter}')
    first.unmount()
    expect(useTourStore.getState().done).toContain('search')

    // 그 뒤에 바다 · 방향키 · 부표를 배워도 검색 안내는 다시 서지 않습니다
    useTourStore.setState((state) => ({
      done: [...state.done, 'sea', 'keys', 'buoy'],
    }))
    render(<Bar introduce />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('[×] 를 눌러도 입력칸 초점과 시작 문장은 그대로다', async () => {
    const user = userEvent.setup()
    sailed()
    render(<Bar introduce />)

    await user.click(screen.getByRole('searchbox'))
    await user.click(screen.getByRole('button', { name: '안내 닫기' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveFocus()
    expect(
      screen.getByRole('group', { name: '이렇게 찾아 보세요' }),
    ).toBeInTheDocument()
  })

  // 메인의 `TourSpotlight` 가 안내 동안 밝혀 두는 자리 — 안내가 말하는 이름표 · 입력칸이 든 알약입니다
  it('안내가 가리키는 알약(이름표 · 입력칸)에 표시를 단다', () => {
    sailed()
    render(<Bar introduce />)

    const target = screen
      .getByRole('search')
      .closest<HTMLElement>('[data-tour-target="search"]')
    expect(target).not.toBeNull()
    expect(target).toContainElement(screen.getByRole('searchbox'))
    expect(target).toContainElement(screen.getByText(TAG))
    expect(target).not.toContainElement(screen.getByRole('status'))
  })

  it('안내 동안 입력칸을 눌러 펼친 시작 문장에도 표시를 단다 — 막 밑에 깔리지 않게', async () => {
    const user = userEvent.setup()
    sailed()
    render(<Bar introduce />)

    await user.click(screen.getByRole('searchbox'))

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: '이렇게 찾아 보세요' }),
    ).toHaveAttribute('data-tour-target', 'search')
  })

  it('끝낸 안내는 다음 방문에 다시 서지 않는다', async () => {
    const user = userEvent.setup()
    sailed()
    const first = render(<Bar introduce />)
    await user.click(screen.getByRole('button', { name: '안내 닫기' }))
    first.unmount()

    render(<Bar introduce />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

// '자연어' 는 만든 사람의 말이라 처음 온 사람이 아는 향수 이름을 넣었습니다 (지인 피드백 F1)
describe('이름표', () => {
  it('무엇을 적는 칸인지 말하고, 방식을 바꾸는 단추는 없다', () => {
    render(<Bar />)

    expect(screen.getByText(TAG)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: '이름으로' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('자연어')).not.toBeInTheDocument()
  })

  it('누르면 입력칸에 초점이 가고 시작 문장이 펼쳐진다', async () => {
    const user = userEvent.setup()
    render(<Bar />)

    await user.click(screen.getByText(TAG))

    expect(screen.getByRole('searchbox')).toHaveFocus()
    expect(
      screen.getByRole('group', { name: '이렇게 찾아 보세요' }),
    ).toBeInTheDocument()
  })

  it('입력 전에 적을 말의 예시를 보여 준다', () => {
    render(<Bar />)

    expect(
      screen.getByPlaceholderText('예) 상큼한 향, 풀향'),
    ).toBeInTheDocument()
  })
})
