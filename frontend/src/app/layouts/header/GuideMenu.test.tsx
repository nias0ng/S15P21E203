import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTourStore } from '@/shared/store/tourStore'

import { GuideMenu } from './GuideMenu'
import { inkOf } from './tone'

const renderMenu = () => render(<GuideMenu ink={inkOf('glass')} />)
const trigger = () => screen.getByRole('button', { name: '이용 안내' })

beforeEach(() => {
  localStorage.clear()
  useTourStore.setState({ done: [], off: false, wanted: [], active: null })
})
afterEach(() => vi.unstubAllGlobals())

describe('GuideMenu', () => {
  it("'?' 를 누르면 조작법과 이 사이트가 쓰는 말을 푼다", async () => {
    renderMenu()

    await userEvent.click(trigger())
    const panel = screen.getByRole('dialog', { name: '이용 안내' })

    expect(panel).toHaveTextContent('바다를 누르면 배가 그쪽으로 가요')
    expect(panel).toHaveTextContent('← → ↑ 로 배를 직접 몰 수 있어요')
    expect(panel).toHaveTextContent('같은 향 계열(플로럴 · 우디 …)이 모인 바다')
    expect(panel).toHaveTextContent('탐색 %')
  })

  it('손가락 기기에는 방향키 대신 미니맵을 두 번 누르라고 적는다', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    renderMenu()

    await userEvent.click(trigger())
    const panel = screen.getByRole('dialog', { name: '이용 안내' })

    expect(panel).toHaveTextContent(
      '미니맵의 이름을 두 번 누르면 그 해역으로 가요',
    )
    expect(panel).not.toHaveTextContent('← → ↑')
  })

  it('[안내 처음부터 다시 보기] 는 끝낸 안내 · 끄기를 풀고 판을 닫는다', async () => {
    useTourStore.setState({ done: ['welcome', 'search'], off: true })
    renderMenu()

    await userEvent.click(trigger())
    await userEvent.click(
      screen.getByRole('button', { name: '안내 처음부터 다시 보기' }),
    )

    expect(useTourStore.getState()).toMatchObject({ done: [], off: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Esc 로 닫으면 초점이 단추로 돌아온다', async () => {
    renderMenu()

    await userEvent.click(trigger())
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })
})
