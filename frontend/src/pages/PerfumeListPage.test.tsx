import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PerfumeListPage from './PerfumeListPage'

const api = vi.hoisted(() => ({ searchPerfumes: vi.fn() }))

vi.mock('@/features/perfume/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

const renderPage = (path = '/perfumes') =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <PerfumeListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  api.searchPerfumes.mockReset()
  api.searchPerfumes.mockResolvedValue({
    perfumes: [],
    page: 0,
    size: 30,
    totalElements: 0,
  })
})

describe('PerfumeListPage', () => {
  // 기준 없이 부르면 향수 번호순이 '인기 향수' 제목 아래 섰습니다 (지인 피드백 F7 · F23)
  it('아무 조건이 없으면 국내 선정 순위로 줄 세운다', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: '향 지도의 대표 향수' }),
    ).toBeInTheDocument()
    expect(api.searchPerfumes).toHaveBeenCalledWith(
      expect.objectContaining({ ranking: 'POPULAR' }),
    )
  })

  // 순위를 걸면 순위 밖 13만 개가 검색 결과에서 빠집니다
  it('검색할 때는 순위를 걸지 않는다', async () => {
    renderPage('/perfumes?keyword=%EB%AF%B8%EB%A5%B4%ED%86%A0')

    await screen.findByRole('heading', { name: '검색 결과' })
    expect(api.searchPerfumes).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '미르토', ranking: undefined }),
    )
  })

  it('고른 순위 필터가 있으면 그것을 쓴다', async () => {
    renderPage('/perfumes?ranking=WISH')

    await screen.findByRole('heading', { name: '조건에 맞는 향수' })
    expect(api.searchPerfumes).toHaveBeenCalledWith(
      expect.objectContaining({ ranking: 'WISH' }),
    )
  })
})
