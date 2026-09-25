import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PerfumeDetail, ReviewAggregates } from '@/features/perfume'

import PerfumeDetailPage from './PerfumeDetailPage'

const api = vi.hoisted(() => ({
  getPerfumeDetail: vi.fn(),
  getPerfumeNotes: vi.fn(),
  getRelatedPerfumes: vi.fn(),
  getPerfumeReviews: vi.fn(),
  getPerfumeReviewAggregates: vi.fn(),
  startPerfumeView: vi.fn(),
  exitPerfumeView: vi.fn(),
}))

vi.mock('@/features/perfume/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

const PERFUME_ID = 135

const detail: PerfumeDetail = {
  perfumeId: PERFUME_ID,
  name: 'French Riviera',
  nameKo: '프렌치 리비에라',
  gender: null,
  concentration: null,
  brand: { brandId: 1, name: 'Mancera' },
  images: [],
  prices: [],
  myReviewId: null,
}

const aggregates: ReviewAggregates = {
  reviewSummary: {
    summary: '달콤한 향이 먼저 느껴진다는 의견이 많습니다.',
    sourceReviewCount: 7,
    updatedAt: '2026-09-10T04:22:58.535890Z',
  },
  reviewKeywords: {
    keywords: [{ keyword: '달콤한', percentage: 81.8 }],
  },
  reviewStatistics: { reviewCount: 7 },
  seasonStatistics: {
    seasons: [
      { seasonId: 1, code: 'SPRING', name: '봄', count: 2, percentage: 28.6 },
      { seasonId: 2, code: 'SUMMER', name: '여름', count: 1, percentage: 14.3 },
      { seasonId: 3, code: 'AUTUMN', name: '가을', count: 2, percentage: 28.6 },
      { seasonId: 4, code: 'WINTER', name: '겨울', count: 2, percentage: 28.6 },
    ],
  },
}

const renderAt = (path: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/perfumes/:perfumeId" element={<PerfumeDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const renderDetail = async () => {
  renderAt(`/perfumes/${PERFUME_ID}`)

  await screen.findByRole('heading', { name: '계절별 평가' })
}

beforeEach(() => {
  api.getPerfumeDetail.mockResolvedValue(detail)
  api.getPerfumeNotes.mockResolvedValue({ notes: [], accords: [] })
  api.getRelatedPerfumes.mockResolvedValue([])
  api.getPerfumeReviews.mockResolvedValue({
    reviews: [],
    page: 0,
    size: 10,
    totalElements: 0,
  })
  api.startPerfumeView.mockResolvedValue({
    perfumeViewId: 1,
    viewedAt: '2026-09-23T00:00:00Z',
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('PerfumeDetailPage 의 후기 집계', () => {
  it('값이 오면 네 구역에 꽂는다', async () => {
    api.getPerfumeReviewAggregates.mockResolvedValue(aggregates)

    await renderDetail()

    expect(
      await screen.findByText('달콤한 향이 먼저 느껴진다는 의견이 많습니다.'),
    ).toBeInTheDocument()
    expect(screen.getByText('달콤한 81.8%')).toBeInTheDocument()
    expect(screen.getByText('14.3%')).toBeInTheDocument()
    expect(screen.getAllByText('28.6%')).toHaveLength(3)
    expect(screen.getByText('7개')).toBeInTheDocument()
  })

  it('불러오는 중에는 값을 비운 채 자리를 지킨다', async () => {
    api.getPerfumeReviewAggregates.mockReturnValue(new Promise(() => {}))

    await renderDetail()

    expect(screen.getByText('요약을 불러오는 중입니다.')).toBeInTheDocument()
    expect(screen.getAllByText('0%')).toHaveLength(4)
  })

  it('집계 요청이 실패해도 화면은 서고 집계 구역만 빈 상태가 된다', async () => {
    api.getPerfumeReviewAggregates.mockRejectedValue(new Error('집계 실패'))

    await renderDetail()

    expect(
      await screen.findByText('후기가 충분히 쌓이면 요약을 보여드립니다.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '계절별 평가' }),
    ).toBeInTheDocument()
    expect(screen.getByText('프렌치 리비에라')).toBeInTheDocument()

    expect(
      screen.queryByText('향을 언급한 후기에서 자주 나온 표현'),
    ).not.toBeInTheDocument()
  })

  it('집계가 없으면 후기 수를 후기 목록에서 가져온다', async () => {
    api.getPerfumeReviewAggregates.mockRejectedValue(new Error('집계 실패'))
    api.getPerfumeReviews.mockResolvedValue({
      reviews: [],
      page: 0,
      size: 10,
      totalElements: 3,
    })

    await renderDetail()

    expect(await screen.findByText('3개')).toBeInTheDocument()
  })
})

describe('PerfumeDetailPage 의 주소', () => {
  it('번호가 아닌 주소는 부르지 않고 안내를 띄운다', async () => {
    renderAt('/perfumes/abc')

    expect(
      await screen.findByText('향수 상세 정보를 불러오지 못했습니다'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '다시 시도' }),
    ).not.toBeInTheDocument()
    expect(api.getPerfumeDetail).not.toHaveBeenCalled()
  })
})
