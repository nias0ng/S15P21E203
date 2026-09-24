import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PersonalRecommendationResult } from '../types'

import { RecommendLetter, type LetterFacts } from './RecommendLetter'

const api = vi.hoisted(() => ({ recordPersonalExposure: vi.fn() }))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

/** 서버 응답 그대로의 한 통 — 근거는 적합도 틀이라 향 특성이 영어로 옵니다 */
const ready = (
  token = 'token-1',
  perfumeId = 102,
): PersonalRecommendationResult => ({
  status: 'ready',
  recommendation: {
    recommendationToken: token,
    perfumeId,
    name: '아티산 블랙',
    imageUrl: null,
    reason: '높게 평가한 향수와 woody 어코드가 비슷해요.',
  },
})

const FACTS: LetterFacts = {
  perfumeId: 102,
  brand: 'John Varvatos',
  nameEn: 'Artisan Black',
  accords: ['시트러스', '우디', '아로마틱'],
}

const renderLetter = (
  props: Partial<Parameters<typeof RecommendLetter>[0]> = {},
) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <MemoryRouter>
        <RecommendLetter
          result={ready()}
          isRefreshing={false}
          onNext={vi.fn()}
          facts={FACTS}
          recipient="향해테스터"
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  api.recordPersonalExposure.mockReset()
  api.recordPersonalExposure.mockResolvedValue(undefined)
})

describe('RecommendLetter', () => {
  it('추천이 없거나 아직 모르면 봉투를 꽂지 않는다', () => {
    const { container, rerender } = renderLetter({ result: undefined })
    expect(container).toBeEmptyDOMElement()

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecommendLetter
            result={{ status: 'none' }}
            isRefreshing={false}
            onNext={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('봉투를 펼치면 받는 사람 · 갈래 머리말 · 한국어로 옮긴 근거가 적힌 편지가 된다', async () => {
    const user = userEvent.setup()
    renderLetter()

    // 접혀 있는 동안 편지는 봉투 속이라 낭독기에 없습니다
    expect(
      screen.queryByRole('heading', {
        name: '마음에 든 향과 닮은 향수를 찾았어요',
      }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: '새로 온 향수 편지 열기' }),
    )

    const letter = screen.getByRole('region', { name: '당신을 위한 향수 편지' })
    expect(letter).toHaveTextContent('향해테스터님께')
    expect(
      screen.getByRole('heading', {
        name: '마음에 든 향과 닮은 향수를 찾았어요',
      }),
    ).toBeInTheDocument()
    // 영어 향 특성(woody)을 한국어로 옮기고, 근거가 된 말에 형광펜을 긋습니다
    expect(letter).toHaveTextContent(
      '높게 평가한 향수와 우디 어코드가 비슷해요.',
    )
    expect(screen.getByText('우디', { selector: 'mark' })).toBeInTheDocument()
    expect(screen.getByText('John Varvatos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '자세히 보기' })).toHaveAttribute(
      'href',
      '/perfumes/102',
    )
  })

  it('펼쳤을 때만 노출을 한 번 남긴다 — 봉투가 보인 것만으로는 남기지 않는다', async () => {
    const user = userEvent.setup()
    renderLetter()
    expect(api.recordPersonalExposure).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: '새로 온 향수 편지 열기' }),
    )
    await user.click(screen.getByRole('button', { name: '편지 접기' }))
    // 읽은 편지는 봉인이 떨어져 "다시 열기" 입니다
    await user.click(
      screen.getByRole('button', { name: '향수 편지 다시 열기' }),
    )

    expect(api.recordPersonalExposure).toHaveBeenCalledTimes(1)
    expect(api.recordPersonalExposure.mock.calls[0]?.[0]).toBe('token-1')
  })

  it('다른 향수를 받으면 새 편지로 넘어가고, 앞 편지로 돌아갈 수 있다', async () => {
    const user = userEvent.setup()
    const { rerender } = renderLetter()
    await user.click(
      screen.getByRole('button', { name: '새로 온 향수 편지 열기' }),
    )

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecommendLetter
            result={{
              status: 'ready',
              recommendation: {
                recommendationToken: 'token-2',
                perfumeId: 7,
                name: '아티산',
                imageUrl: null,
                reason: '취향 테스트에서 선택한 시트러스 계열과 잘 맞아요.',
              },
            }}
            isRefreshing={false}
            onNext={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(
      screen.getByRole('heading', {
        name: '취향 테스트가 고른 향수가 도착했어요',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '앞 편지' }))
    expect(
      screen.getByRole('heading', {
        name: '마음에 든 향과 닮은 향수를 찾았어요',
      }),
    ).toBeInTheDocument()
  })

  it('Esc 로 접으면 봉투로 포커스가 돌아온다', async () => {
    const user = userEvent.setup()
    renderLetter()
    await user.click(
      screen.getByRole('button', { name: '새로 온 향수 편지 열기' }),
    )
    expect(screen.getByRole('button', { name: '편지 접기' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(
      screen.getByRole('button', { name: '향수 편지 다시 열기' }),
    ).toHaveFocus()
  })

  it('취향 테스트 전이면 봉하지 않은 봉투가 꽂히고, 펼치면 테스트로 이끈다', async () => {
    const user = userEvent.setup()
    renderLetter({ result: { status: 'needs-taste-test' }, facts: undefined })

    await user.click(
      screen.getByRole('button', {
        name: /취향 테스트를 마치면 편지가 도착해요/,
      }),
    )

    expect(
      screen.getByRole('link', { name: '취향 테스트 하러 가기' }),
    ).toHaveAttribute('href', '/test')
    expect(api.recordPersonalExposure).not.toHaveBeenCalled()
  })
})
