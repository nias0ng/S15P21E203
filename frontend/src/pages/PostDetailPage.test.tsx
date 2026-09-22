import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES, toPostDetail } from '@/shared/config/routes'
import { useAuthStore } from '@/shared/store/authStore'

import PostDetailPage from './PostDetailPage'

const POST_ID = 1

const detail = (over: { liked?: boolean; likeCount?: number } = {}) => ({
  postId: POST_ID,
  category: 'CHAT',
  nickname: '향해테스터',
  title: '요즘 손이 가는 향수',
  content: '본문입니다',
  imageUrls: [],
  relatedPerfumes: [],
  collectionId: null,
  collectionTitle: null,
  commentCount: 0,
  likeCount: 3,
  viewCount: 10,
  liked: false,
  mine: false,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  ...over,
})

const api = vi.hoisted(() => ({
  getPostDetail: vi.fn(),
  getComments: vi.fn(),
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}))

vi.mock('@/features/community/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[toPostDetail(POST_ID)]}>
        <Routes>
          <Route path={ROUTES.POST_DETAIL} element={<PostDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

const logIn = () =>
  useAuthStore.getState().setAuth({
    accessToken: 'token',
    user: { id: 1, nickname: '향해', email: 'a@b.c' },
  })

beforeEach(() => {
  api.getPostDetail.mockResolvedValue(detail())
  api.getComments.mockResolvedValue({
    comments: [],
    page: 0,
    size: 20,
    totalElements: 0,
  })
  api.likePost.mockResolvedValue({ postId: POST_ID, liked: true, likeCount: 4 })
  api.unlikePost.mockResolvedValue({
    postId: POST_ID,
    liked: false,
    likeCount: 2,
  })
})

afterEach(() => {
  useAuthStore.getState().clear()
  vi.clearAllMocks()
})

describe('PostDetailPage 좋아요', () => {
  /*
    `useLikeToggle` 이 생긴 까닭이 이것입니다 — 세 화면이 각자 쓰다가 후기 상세에만
    안내가 빠져 있었고, 비로그인이 누르면 401 만 났습니다. 같은 구멍을 여기서 막습니다.
  */
  it('비로그인으로 누르면 서버에 보내지 않고 로그인 안내를 띄운다', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /좋아요/ }))

    expect(api.likePost).not.toHaveBeenCalled()
    expect(
      screen.getByText(/좋아요는 로그인한 뒤에 누를 수 있습니다/),
    ).toBeInTheDocument()
  })

  it('누르면 그 자리에서 좋아요 수가 오른다', async () => {
    logIn()
    renderPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '좋아요 3' }),
    )

    expect(api.likePost).toHaveBeenCalledWith(POST_ID)
    expect(
      await screen.findByRole('button', { name: '좋아요 4' }),
    ).toBeInTheDocument()
  })

  it('이미 누른 글이면 취소를 부른다', async () => {
    api.getPostDetail.mockResolvedValue(detail({ liked: true, likeCount: 3 }))
    logIn()
    renderPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '좋아요 3' }),
    )

    expect(api.unlikePost).toHaveBeenCalledWith(POST_ID)
    expect(api.likePost).not.toHaveBeenCalled()
  })
})
