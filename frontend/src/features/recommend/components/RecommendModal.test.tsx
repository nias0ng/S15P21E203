import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RecommendResult } from '../types'

import { RecommendModal } from './RecommendModal'

const api = vi.hoisted(() => ({ getRecommendation: vi.fn() }))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

const QUERY = '미모사랑 장미 들어간 밤에 쓸 향수'

/**
 * 노트를 말한 문장의 실제 모양입니다. AI 가 '미모사' · '장미' 를 accord 로 풀어 보내면서
 * 어느 글자에서 왔는지를 안 채워, `reasons` 의 `phrase` 가 비어 있습니다 — 사용자가 쓴 말은
 * `matchedData` 에만 남습니다.
 */
const result = (overrides: Partial<RecommendResult> = {}): RecommendResult => ({
  recommendationToken: null,
  status: 'OK_RELAXED',
  query: QUERY,
  pickedWithoutScentCondition: false,
  matchedData: [
    { field: 'note', label: '미모사' },
    { field: 'note', label: '장미' },
    { field: 'daypart', label: '밤' },
  ],
  perfumes: [
    {
      perfumeId: 1,
      name: '오 로즈',
      brand: '딥디크',
      thumbnailUrl: null,
      reasons: [{ phrase: null, evidence: 'floral · powdery · rose' }],
    },
  ],
  ...overrides,
})

const renderModal = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <RecommendModal query={QUERY} onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => api.getRecommendation.mockReset())

describe('RecommendModal', () => {
  it('향이 아닌 근거를 목록 위에 그린다', async () => {
    api.getRecommendation.mockResolvedValue(result())

    renderModal()

    /*
      이 줄이 없으면 사용자가 쓴 말이 화면에서 통째로 사라집니다 — 카드에는
      'floral · powdery · rose' 만 남아 미모사도 장미도 밤도 안 보입니다.
    */
    expect(await screen.findByText(/미모사 · 장미 · 밤/)).toBeInTheDocument()
  })

  it('matchedData 가 빠진 응답에도 결과를 그린다', async () => {
    /*
      계약상 늘 오는 자리지만, 이 필드를 모르는 서버와 만나는 순간이 있습니다. 그때
      `length` 를 그냥 읽으면 모달이 통째로 에러 바운더리로 떨어져, 근거 한 줄이 아니라
      추천 목록까지 사라집니다.
    */
    const { matchedData: _omitted, ...withoutMatchedData } = result()
    api.getRecommendation.mockResolvedValue(
      withoutMatchedData as unknown as RecommendResult,
    )

    renderModal()

    expect(await screen.findByText('오 로즈')).toBeInTheDocument()
    expect(screen.queryByText(/조건으로 좁혔습니다/)).not.toBeInTheDocument()
  })

  it('향으로 고른 것이 아니면 조건을 넓혔다고 말하지 않는다', async () => {
    api.getRecommendation.mockResolvedValue(
      result({ pickedWithoutScentCondition: true }),
    )

    renderModal()

    // 향 조건을 하나도 못 뽑았고 순서를 정한 것은 평가자 수입니다
    expect(
      await screen.findByText(/향을 말씀하신 것으로 읽지 못해/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/조건이 넓어/)).not.toBeInTheDocument()
  })
})
