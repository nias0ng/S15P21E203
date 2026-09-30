import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

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

const renderModal = (onClose = vi.fn()) => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <RecommendModal query={QUERY} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return onClose
}

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

  /*
    판이 3D 바다 위에 떠 있어 배경이 화면의 대부분입니다. 결과를 읽다 옆을 잘못 누르면 다섯
    장이 통째로 사라지고, 다시 보려면 검색어를 처음부터 다시 적어야 합니다.
  */
  it('배경을 눌러도 닫지 않는다', async () => {
    api.getRecommendation.mockResolvedValue(result())

    const onClose = renderModal()
    const dialog = (
      await screen.findByRole('heading', { name: '추천 결과' })
    ).closest('dialog')!

    fireEvent.click(dialog)

    expect(onClose).not.toHaveBeenCalled()
  })

  // 배경을 막는 것은 잘못 누르는 것을 막으려는 것이지 가두려는 것이 아닙니다
  it('[×] 와 Esc 로는 닫힌다', async () => {
    api.getRecommendation.mockResolvedValue(result())

    const onClose = renderModal()
    await userEvent.click(await screen.findByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledOnce()

    const dialog = screen
      .getByRole('heading', { name: '추천 결과' })
      .closest('dialog')!
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('영어 화면은 영어로 쓰고, 한국어로 적으면 잘 알아듣는다고 알린다', async () => {
    useLocaleStore.getState().setLocale('en')
    api.getRecommendation.mockResolvedValue(result())

    renderModal()

    expect(
      await screen.findByRole('heading', { name: 'Recommendations' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Works best when you type in Korean'),
    ).toBeInTheDocument()
    // AI 가 영어 이름을 주지 않는 노트는 한국어 그대로 둡니다
    expect(await screen.findByText('미모사 · 장미 · 밤')).toBeInTheDocument()
    expect(screen.getByText(/Narrowed down by/)).toBeInTheDocument()
  })
})
