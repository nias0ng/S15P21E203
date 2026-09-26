import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@/shared/config/routes'
import { useAuthStore } from '@/shared/store/authStore'
import { useDiveStore } from '@/shared/store/diveStore'

import { GlobalHeader } from '../GlobalHeader'

const api = vi.hoisted(() => ({ logout: vi.fn(), getMe: vi.fn() }))

vi.mock('@/features/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

/*
  NOTE: 계정 단추가 아바타를 그리려고 `meQuery` 를 켭니다. 아래 `logIn()` 이 도는
  시험은 전부 그 쿼리가 참이 되므로, 막지 않으면 진짜 요청이 나가고 401 인터셉터가
  스토어를 비웁니다 — `accessToken` 단언이 깨지고, 시험이 끝난 뒤 도착하는 거절이
  위 `useWarm` 과 같은 방식으로 종료 코드를 흔듭니다.
*/
vi.mock('@/features/auth/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

const ME = {
  userId: 1,
  email: 'tester@hyanghae.dev',
  nickname: '향해테스터',
  profileImageUrl: null as string | null,
}

const warm = vi.hoisted(() => vi.fn())

/*
  NOTE: 미리 받기를 시험에서 막습니다. `useWarm` 안이 화면 청크를 `import()` 로
  부르는데 **아무도 기다리지 않습니다.** `userEvent.click` 은 누르기 전에
  `pointerenter` 를 같이 일으켜 여기서도 그 import 가 뜨고, 시험이 먼저 끝나면
  Vitest 가 import 한가운데 환경을 걷어 갑니다 — `EnvironmentTeardownError` 가
  처리되지 않은 오류로 남아 **다 통과해도 종료 코드가 1** 이 됩니다.
*/
vi.mock('./useWarm', () => ({ useWarm: () => warm }))

/** 지금 어느 주소에 서 있는지 시험이 볼 수 있게 적어 둡니다 */
function Here() {
  return <div>{`지금: ${useLocation().pathname}`}</div>
}

const renderHeader = (at: string) => {
  const queryClient = new QueryClient()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[at]}>
        <GlobalHeader />
        <Routes>
          <Route path="*" element={<Here />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

const logIn = () =>
  useAuthStore.getState().setAuth({
    accessToken: 'token',
    user: { id: 1, nickname: '향해테스터', email: 'tester@hyanghae.dev' },
  })

beforeEach(() => {
  api.logout.mockReset().mockResolvedValue(undefined)
  api.getMe.mockReset().mockResolvedValue(ME)
  warm.mockClear()
})

afterEach(() => {
  useAuthStore.getState().clear()
  useDiveStore.getState().end()
})

describe('헤더 드롭다운', () => {
  it.each([
    ['COMMUNITY', false],
    ['내 계정', true],
  ])('%s 메뉴는 Esc 로 닫힌다', async (name, needsLogin) => {
    const user = userEvent.setup()
    if (needsLogin) logIn()
    renderHeader(ROUTES.PERFUMES)

    const trigger = screen.getByRole('button', { name })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('바깥을 누르면 닫힌다', async () => {
    const user = userEvent.setup()
    renderHeader(ROUTES.PERFUMES)

    const trigger = screen.getByRole('button', { name: 'COMMUNITY' })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(document.body)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('커뮤니티 메뉴를 열면 후기 · 자유가 보인다', async () => {
    const user = userEvent.setup()
    renderHeader(ROUTES.PERFUMES)

    await user.click(screen.getByRole('button', { name: 'COMMUNITY' }))

    expect(screen.getByRole('menuitem', { name: '후기' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: '자유' })).toBeVisible()
  })
})

// 잠수는 주소를 바로 바꾸지 않고 커튼이 덮은 뒤에 옮겨 가므로, 누른 직후에는
// 아직 메인에 서 있어야 합니다
describe('메인에서 나가는 잠수', () => {
  it('메인에서 향수를 누르면 주소가 바로 바뀌지 않고 잠수가 걸린다', async () => {
    const user = userEvent.setup()
    renderHeader(ROUTES.HOME)

    await user.click(screen.getByRole('link', { name: 'PERFUME' }))

    expect(screen.getByText(`지금: ${ROUTES.HOME}`)).toBeVisible()
    expect(useDiveStore.getState().stage).not.toBe('idle')
    expect(useDiveStore.getState().to).toBe(ROUTES.PERFUMES)
  })

  it('메인이 아니면 곧바로 넘어간다', async () => {
    const user = userEvent.setup()
    renderHeader(ROUTES.PERFUMES)

    await user.click(screen.getByRole('link', { name: 'BRAND' }))

    expect(screen.getByText(`지금: ${ROUTES.BRANDS}`)).toBeVisible()
    expect(useDiveStore.getState().stage).toBe('idle')
  })

  it('Ctrl 을 누른 채 누르면 가로채지 않는다', async () => {
    const user = userEvent.setup()
    renderHeader(ROUTES.HOME)

    await user.keyboard('{Control>}')
    await user.click(screen.getByRole('link', { name: 'PERFUME' }))
    await user.keyboard('{/Control}')

    expect(useDiveStore.getState().stage).toBe('idle')
  })
})

// 진열대는 바다 밑이 아니라 배 안이라, 잠수가 아니라 **선실로 들어가기**가 걸립니다
describe('메인에서 진열대로 — 선실로 들어가기', () => {
  it('메인에서 SHELF 를 누르면 주소가 바로 바뀌지 않고 선실로 들어간다', async () => {
    const user = userEvent.setup()
    logIn()
    renderHeader(ROUTES.HOME)

    await user.click(screen.getByRole('link', { name: 'SHELF' }))

    expect(screen.getByText(`지금: ${ROUTES.HOME}`)).toBeVisible()
    expect(useDiveStore.getState()).toMatchObject({
      stage: 'diving',
      way: 'cabin',
      to: ROUTES.MY_SHELF,
    })
  })

  it('메인이 아니면 SHELF 도 곧바로 넘어간다', async () => {
    const user = userEvent.setup()
    logIn()
    renderHeader(ROUTES.PERFUMES)

    await user.click(screen.getByRole('link', { name: 'SHELF' }))

    expect(screen.getByText(`지금: ${ROUTES.MY_SHELF}`)).toBeVisible()
    expect(useDiveStore.getState().stage).toBe('idle')
  })
})

describe('로그아웃', () => {
  it('서버에 알리고 토큰과 캐시를 비운 뒤 메인으로 보낸다', async () => {
    const user = userEvent.setup()
    logIn()
    const { queryClient } = renderHeader(ROUTES.PERFUMES)
    queryClient.setQueryData(['anything'], '앞 사람 화면')

    await user.click(screen.getByRole('button', { name: '내 계정' }))
    await user.click(screen.getByRole('menuitem', { name: '로그아웃' }))

    expect(api.logout).toHaveBeenCalled()
    expect(await screen.findByText(`지금: ${ROUTES.HOME}`)).toBeVisible()
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(queryClient.getQueryData(['anything'])).toBeUndefined()
  })

  it('로그아웃 요청이 실패해도 이 브라우저에서는 나간다', async () => {
    const user = userEvent.setup()
    api.logout.mockRejectedValue(new Error('네트워크'))
    logIn()
    renderHeader(ROUTES.PERFUMES)

    await user.click(screen.getByRole('button', { name: '내 계정' }))
    await user.click(screen.getByRole('menuitem', { name: '로그아웃' }))

    expect(await screen.findByText(`지금: ${ROUTES.HOME}`)).toBeVisible()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})

describe('로그인 여부', () => {
  it('비로그인이면 진열대 메뉴가 없고 로그인 단추가 선다', () => {
    renderHeader(ROUTES.PERFUMES)

    expect(
      screen.queryByRole('link', { name: 'SHELF' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '로그인' })).toBeVisible()
  })

  it('로그인하면 진열대 메뉴와 계정 아이콘이 선다', () => {
    logIn()
    renderHeader(ROUTES.PERFUMES)

    expect(screen.getByRole('link', { name: 'SHELF' })).toBeVisible()
    expect(screen.getByRole('button', { name: '내 계정' })).toBeVisible()
  })
})

describe('계정 단추의 프로필 사진', () => {
  it('사진이 있으면 아바타가 선다', async () => {
    api.getMe.mockResolvedValue({
      ...ME,
      profileImageUrl: '/api/v1/users/profile-images/2026/09/a.jpg',
    })
    logIn()
    renderHeader(ROUTES.PERFUMES)

    expect(
      await screen.findByRole('img', { name: '내 프로필 사진' }),
    ).toBeVisible()
  })

  /* 사진이 없으면 자리표시자 상자가 아니라 원래 아이콘이 서야 합니다 */
  it('사진이 없으면 아바타 없이 기본 아이콘만 선다', async () => {
    logIn()
    renderHeader(ROUTES.PERFUMES)

    expect(await screen.findByRole('button', { name: '내 계정' })).toBeVisible()
    expect(
      screen.queryByRole('img', { name: '내 프로필 사진' }),
    ).not.toBeInTheDocument()
  })

  it('비로그인이면 내 정보를 묻지 않는다', () => {
    renderHeader(ROUTES.PERFUMES)

    expect(api.getMe).not.toHaveBeenCalled()
  })
})
