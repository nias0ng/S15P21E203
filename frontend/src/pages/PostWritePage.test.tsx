import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES, toPostEdit } from '@/shared/config/routes'
import { useAuthStore } from '@/shared/store/authStore'

import PostWritePage from './PostWritePage'

const POST_ID = 5
const COLLECTION_ID = 7

const PERFUMES = [
  { perfumeId: 11, name: '향수 하나', brand: '브랜드' },
  { perfumeId: 12, name: '향수 둘', brand: null },
]

const post = (over: Record<string, unknown> = {}) => ({
  postId: POST_ID,
  category: 'COLLECTION',
  nickname: '향해테스터',
  title: '저녁 약속 컬렉션을 소개합니다',
  content: '본문입니다',
  imageUrls: [],
  relatedPerfumes: PERFUMES,
  collectionId: COLLECTION_ID,
  collectionTitle: '저녁 약속',
  commentCount: 0,
  likeCount: 0,
  viewCount: 1,
  liked: false,
  mine: true,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  ...over,
})

const community = vi.hoisted(() => ({
  getPostDetail: vi.fn(),
  updatePost: vi.fn(),
  createPost: vi.fn(),
}))

const collection = vi.hoisted(() => ({
  getMyCollections: vi.fn(),
  getCollectionDetail: vi.fn(),
}))

const MY_COLLECTION = {
  collectionId: COLLECTION_ID,
  title: '저녁 약속',
  description: null,
  perfumeCount: 2,
}

const COLLECTION_PERFUMES = [
  {
    shelfItemId: 101,
    perfumeId: 11,
    name: '향수 하나',
    brand: '브랜드',
    thumbnailUrl: null,
  },
  {
    shelfItemId: 102,
    perfumeId: 12,
    name: '향수 둘',
    brand: null,
    thumbnailUrl: null,
  },
]

vi.mock('@/features/community/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...community }
})

vi.mock('@/features/collection/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...collection }
})

const renderWrite = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[ROUTES.POST_WRITE]}>
        <Routes>
          <Route path={ROUTES.POST_WRITE} element={<PostWritePage />} />
          <Route path="*" element={<p>다른 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

const renderEdit = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[toPostEdit(POST_ID)]}>
        <Routes>
          <Route path={ROUTES.POST_EDIT} element={<PostWritePage />} />
          <Route path="*" element={<p>다른 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

const submitAndReadPayload = async () => {
  await userEvent.click(screen.getByRole('button', { name: '수정' }))
  await waitFor(() => expect(community.updatePost).toHaveBeenCalled())

  const call = community.updatePost.mock.calls[0]
  expect(call?.[0]).toBe(POST_ID)
  return call?.[1] as Record<string, unknown>
}

beforeEach(() => {
  community.getPostDetail.mockResolvedValue(post())
  community.updatePost.mockResolvedValue(undefined)
  collection.getMyCollections.mockResolvedValue([MY_COLLECTION])
  collection.getCollectionDetail.mockResolvedValue({
    ...MY_COLLECTION,
    perfumes: COLLECTION_PERFUMES,
  })
  useAuthStore.getState().setAuth({
    accessToken: 'token',
    user: { id: 1, nickname: '향해', email: 'a@b.c' },
  })
})

afterEach(() => {
  useAuthStore.getState().clear()
  vi.clearAllMocks()
})

describe('PostWritePage 컬렉션 글 수정', () => {
  it('붙어 있던 컬렉션을 수정 화면이 보여준다', async () => {
    renderEdit()

    expect(await screen.findByText('저녁 약속')).toBeInTheDocument()
  })

  it('컬렉션이 그대로면 향수 목록도 컬렉션도 보내지 않는다', async () => {
    renderEdit()
    await screen.findByDisplayValue('저녁 약속 컬렉션을 소개합니다')

    const payload = await submitAndReadPayload()

    expect(payload).not.toHaveProperty('perfumeIds')
    expect(payload).not.toHaveProperty('collectionId')
    expect(payload).toMatchObject({ title: '저녁 약속 컬렉션을 소개합니다' })
  })

  it('컬렉션을 떼면 뗀 사실과 향수 목록을 함께 보낸다', async () => {
    renderEdit()

    await userEvent.click(
      await screen.findByRole('button', { name: '저녁 약속 첨부 해제' }),
    )
    const payload = await submitAndReadPayload()

    expect(payload).toMatchObject({
      collectionId: null,
      perfumeIds: [11, 12],
    })
  })

  it('컬렉션이 없던 글은 향수 목록을 그대로 보낸다', async () => {
    community.getPostDetail.mockResolvedValue(
      post({ category: 'CHAT', collectionId: null, collectionTitle: null }),
    )
    renderEdit()
    await screen.findByDisplayValue('저녁 약속 컬렉션을 소개합니다')

    const payload = await submitAndReadPayload()

    expect(payload).toMatchObject({ perfumeIds: [11, 12] })
    expect(payload).not.toHaveProperty('collectionId')
  })
})

describe('PostWritePage 컬렉션 공유 글의 향수', () => {
  const pickCategory = (label: string) =>
    userEvent.click(screen.getByRole('button', { name: label }))

  const attachCollection = async () => {
    await userEvent.click(
      screen.getByRole('button', { name: '+ 내 컬렉션에서' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /저녁 약속/ }),
    )
  }

  it('컬렉션 공유를 고르면 향수를 직접 고를 수 없다', async () => {
    renderWrite()

    await pickCategory('컬렉션 공유')

    expect(
      screen.queryByRole('button', { name: '+ 향수 선택' }),
    ).not.toBeInTheDocument()
  })

  it('잡담을 고르면 향수를 직접 고를 수 있다', async () => {
    renderWrite()

    await pickCategory('잡담')

    expect(
      screen.getByRole('button', { name: '+ 향수 선택' }),
    ).toBeInTheDocument()
  })

  it('컬렉션을 고르면 그 컬렉션의 향수가 관련 향수에 나타난다', async () => {
    renderWrite()

    await pickCategory('컬렉션 공유')
    await attachCollection()

    expect(await screen.findByText('향수 하나')).toBeInTheDocument()
    expect(screen.getByText('향수 둘')).toBeInTheDocument()
  })

  it('다른 분류로 옮기면 붙여 둔 컬렉션이 풀린다', async () => {
    renderWrite()

    await pickCategory('컬렉션 공유')
    await attachCollection()
    await screen.findByText('향수 하나')

    await pickCategory('잡담')
    await pickCategory('컬렉션 공유')

    expect(
      screen.getByRole('button', { name: '+ 내 컬렉션에서' }),
    ).toBeInTheDocument()
  })

  it('분류를 옮겼다 돌아와 같은 컬렉션을 다시 골라도 향수가 채워진다', async () => {
    renderWrite()

    await pickCategory('컬렉션 공유')
    await attachCollection()
    await screen.findByText('향수 하나')

    await pickCategory('잡담')
    await userEvent.click(
      screen.getByRole('button', { name: '향수 하나 제거' }),
    )
    expect(screen.queryByText('향수 하나')).not.toBeInTheDocument()

    await pickCategory('컬렉션 공유')
    await attachCollection()

    expect(await screen.findByText('향수 하나')).toBeInTheDocument()
  })
})
