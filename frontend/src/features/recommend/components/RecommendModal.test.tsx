import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'
import { useTourStore } from '@/shared/store/tourStore'

import { readOpenRecommendation } from '../openRecommendation'
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
    // 성별 · 계절 · 낮밤은 AI 의 정해진 한국어(`nlr_engine.py` 의 CONTEXT_LABELS)로 옵니다
    { field: 'daypart', label: '밤에 어울리는' },
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

const renderModal = (
  onClose = vi.fn(),
  {
    query = QUERY,
    onRequery,
    onSearchByName,
  }: {
    query?: string
    onRequery?: (query: string) => void
    onSearchByName?: (keyword: string) => void
  } = {},
) => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <RecommendModal
          query={query}
          onClose={onClose}
          onRequery={onRequery}
          onSearchByName={onSearchByName}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return onClose
}

beforeEach(() => {
  api.getRecommendation.mockReset()
  useTourStore.setState({ done: [], off: false, wanted: [], active: null })
})

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

  /*
    추천은 부를 때마다 서버가 새 설문 손잡이를 냅니다. 담아 둔 답을 꺼내면 이미 닫은 손잡이가
    와서, 같은 말로 다시 찾은 사람에게는 만족도 설문이 뜨지 않습니다.
  */
  it('닫았다가 같은 말로 다시 찾으면 서버에 새로 묻는다', async () => {
    api.getRecommendation.mockResolvedValue(result())
    // 앱의 기본값처럼 1분 동안 새로 묻지 않는 캐시입니다 — 이 조건에서 옛 답이 꺼내졌습니다
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 1000 * 60 } },
    })
    const ui = (query: string | null) => (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <RecommendModal query={query} onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    const { rerender } = render(ui(QUERY))
    expect(await screen.findByText('오 로즈')).toBeInTheDocument()

    rerender(ui(null))
    // 닫힌 결과를 버리는 것은 다음 차례(타이머 0)입니다 — 사람이 다시 적는 사이에는 늘 지나갑니다
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))

    rerender(ui(QUERY))
    await waitFor(() => expect(api.getRecommendation).toHaveBeenCalledTimes(2))
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

  describe('향 조건을 하나도 못 뽑았을 때', () => {
    const NAME_QUERY = '아쿠아디파르마 미르토 디 파나레아와 비슷한 향수'
    const noCondition = () =>
      result({
        status: 'NO_CONDITION',
        query: NAME_QUERY,
        perfumes: [],
        matchedData: [],
      })

    // 권한 말을 누르면 곧바로 그 말로 찾습니다 — 따라 적게 하지 않습니다
    it('예시를 누르면 그 말로 다시 찾는다', async () => {
      api.getRecommendation.mockResolvedValue(noCondition())
      const onRequery = vi.fn()

      renderModal(vi.fn(), { query: NAME_QUERY, onRequery })
      await userEvent.click(await screen.findByRole('button', { name: '풀향' }))

      expect(onRequery).toHaveBeenCalledWith('풀향')
    })

    // 메인 검색에 향수 이름을 넣은 사람에게 다음 할 일을 줍니다 (지인 피드백 F1 · F2)
    it('향수 이름이었다면 찾는 말투를 뺀 낱말로 전체 향수에서 찾게 한다', async () => {
      api.getRecommendation.mockResolvedValue(noCondition())
      const onSearchByName = vi.fn()

      renderModal(vi.fn(), { query: NAME_QUERY, onSearchByName })
      await userEvent.click(
        await screen.findByRole('button', { name: /전체 향수에서/ }),
      )

      expect(onSearchByName).toHaveBeenCalledWith(
        '아쿠아디파르마 미르토 디 파나레아',
      )
    })

    it('다시 찾는 길을 안 받았으면 예시를 글로만 보여 준다', async () => {
      api.getRecommendation.mockResolvedValue(noCondition())

      renderModal(vi.fn(), { query: NAME_QUERY })

      expect(
        await screen.findByText(/‘상큼한 향’, ‘풀향’ 처럼요/),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: '풀향' }),
      ).not.toBeInTheDocument()
    })
  })

  // 결과 안내는 결과가 선 뒤에 닫았을 때만 본 것으로 칩니다 — 기다리다 닫았으면 다음 결과에서 다시 섭니다
  it('결과 안내가 선 채로 닫으면 다음 결과에서 다시 서지 않는다', async () => {
    api.getRecommendation.mockResolvedValue(result())

    renderModal()
    await screen.findByText('카드를 누르면 왜 골랐는지 아래에 펼쳐져요.')
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))

    expect(useTourStore.getState().done).toContain('results')
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
    /*
      AI 가 영어 이름을 주지 않는 노트는 사용자가 쓴 한국어 그대로 두고 따옴표로 감쌉니다.
      낮밤 같은 정해진 조건은 영어로 바꿉니다.
    */
    expect(
      await screen.findByText("'미모사' · '장미' · Night"),
    ).toBeInTheDocument()
    expect(screen.getByText(/Narrowed down by/)).toBeInTheDocument()
  })

  describe('영어 화면에서 향 조건을 하나도 못 뽑았을 때', () => {
    const noCondition = () =>
      result({
        status: 'NO_CONDITION',
        query: 'something',
        perfumes: [],
        matchedData: [],
      })

    // 예시는 AI 가 가장 잘 알아듣는 한국어 그대로 두고 뜻을 곁들입니다
    it('예시 단추에 뜻풀이를 곁들이고, 누르면 한국어 예시로 다시 찾는다', async () => {
      useLocaleStore.getState().setLocale('en')
      api.getRecommendation.mockResolvedValue(noCondition())
      const onRequery = vi.fn()

      renderModal(vi.fn(), { query: 'something', onRequery })
      await userEvent.click(
        await screen.findByRole('button', { name: '풀향 (grassy)' }),
      )

      expect(onRequery).toHaveBeenCalledWith('풀향')
    })

    it('다시 찾는 길이 없으면 예시를 뜻풀이와 함께 글로 보여 준다', async () => {
      useLocaleStore.getState().setLocale('en')
      api.getRecommendation.mockResolvedValue(noCondition())

      renderModal(vi.fn(), { query: 'something' })

      expect(
        await screen.findByText(
          "Try describing the smell or feeling — like '상큼한 향' (zesty), '풀향' (grassy).",
        ),
      ).toBeInTheDocument()
    })
  })

  /*
    만족도는 결과 아래 한 줄로 묻습니다 — 닫을 때 따로 뜨던 설문 창은 걷었습니다
    (사용성 테스트 7명 중 6명이 "닫을 때마다 끼어든다" 고 했습니다).
  */
  describe('만족도 한 줄', () => {
    it('결과 아래에 선다', async () => {
      api.getRecommendation.mockResolvedValue(
        result({ recommendationToken: 'token-1' }),
      )

      renderModal()

      expect(
        await screen.findByRole('group', { name: '추천 만족도' }),
      ).toBeInTheDocument()
    })

    // 0개는 추천이 없었던 것이라 답할 것이 없습니다
    it('향수가 0개면 묻지 않는다', async () => {
      api.getRecommendation.mockResolvedValue(
        result({
          recommendationToken: 'token-1',
          status: 'NO_CONDITION',
          perfumes: [],
        }),
      )

      renderModal()

      expect(
        await screen.findByText('어떤 향인지 아직 못 알아들었습니다'),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('group', { name: '추천 만족도' }),
      ).not.toBeInTheDocument()
    })

    // 손잡이가 없으면 서버가 기록에 실패한 것이라 보낼 곳이 없습니다
    it('손잡이가 없으면 묻지 않는다', async () => {
      api.getRecommendation.mockResolvedValue(result())

      renderModal()

      expect(await screen.findByText('오 로즈')).toBeInTheDocument()
      expect(
        screen.queryByRole('group', { name: '추천 만족도' }),
      ).not.toBeInTheDocument()
    })
  })

  /*
    상세에 다녀오면 이 화면이 처음부터 다시 섭니다. 열려 있던 결과를 그대로 펴야 비교하던 다섯
    장이 남고, 같은 손잡이라 설문도 한 번만 걸립니다 (`openRecommendation`).
  */
  describe('상세에 다녀와 다시 펼치기', () => {
    beforeEach(() => sessionStorage.clear())

    it('열려 있던 결과를 주면 서버에 다시 묻지 않고 그대로 편다', async () => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <RecommendModal
              query={QUERY}
              onClose={vi.fn()}
              restored={{ query: QUERY, result: result() }}
            />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      expect(await screen.findByText('오 로즈')).toBeInTheDocument()
      expect(api.getRecommendation).not.toHaveBeenCalled()
    })

    it('다른 말이면 열려 있던 결과를 쓰지 않는다', async () => {
      api.getRecommendation.mockResolvedValue(result())

      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <MemoryRouter>
            <RecommendModal
              query={QUERY}
              onClose={vi.fn()}
              restored={{ query: '다른 말', result: result() }}
            />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => expect(api.getRecommendation).toHaveBeenCalledOnce())
    })

    it('결과가 서면 담아 두고, 사람이 닫으면 버린다', async () => {
      api.getRecommendation.mockResolvedValue(result())

      renderModal()
      await screen.findByText('오 로즈')
      expect(readOpenRecommendation(QUERY)?.result.perfumes).toHaveLength(1)

      await userEvent.click(screen.getByRole('button', { name: '닫기' }))
      expect(readOpenRecommendation(QUERY)).toBeUndefined()
    })
  })
})
