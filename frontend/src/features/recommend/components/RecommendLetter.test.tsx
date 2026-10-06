import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import type { PersonalRecommendationResult } from '../types'

import { RecommendLetter, type LetterFacts } from './RecommendLetter'

const api = vi.hoisted(() => ({ recordPersonalExposure: vi.fn() }))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

/** 서버 응답 그대로의 한 통 — 근거는 적합도라 근거 값이 향 특성의 영어 이름입니다 */
const ready = (
  token = 'token-1',
  perfumeId = 102,
): PersonalRecommendationResult => ({
  status: 'ready',
  recommendation: {
    recommendationToken: token,
    perfumeId,
    name: '아티산 블랙',
    originalName: 'Artisan Black',
    nameKo: '아티산 블랙',
    imageUrl: null,
    reason: '높게 평가한 향수와 woody 어코드가 비슷해요.',
    evidenceSource: 'FIT',
    evidenceKey: 'woody',
  },
})

const FACTS: LetterFacts = {
  perfumeId: 102,
  brand: 'John Varvatos',
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
    // 한국어 이름을 크게, 원래 이름을 그 위에 작게 답니다
    expect(screen.getByText('아티산 블랙')).toHaveClass('rec-name')
    expect(screen.getByText('Artisan Black')).toHaveClass('rec-name-en')
    expect(screen.getByRole('link', { name: '자세히 보기' })).toHaveAttribute(
      'href',
      '/perfumes/102',
    )
  })

  it('영어 화면은 원래 이름을 크게 쓰고, 근거 값으로 영어 문장을 짓는다', async () => {
    useLocaleStore.getState().setLocale('en')
    const user = userEvent.setup()
    renderLetter({
      facts: { ...FACTS, accords: ['Citrus', 'Woody', 'Aromatic'] },
    })

    await user.click(screen.getByRole('button', { name: /open/i }))

    expect(screen.getByText('Artisan Black')).toHaveClass('rec-name')
    expect(screen.queryByText('아티산 블랙')).not.toBeInTheDocument()
    // 문장 안의 향 특성은 소문자입니다 — 형광펜은 문장에 적힌 그대로를 칠합니다
    expect(
      screen.getByText(
        (_, element) =>
          element?.classList.contains('rec-reason') === true &&
          element.textContent ===
            'It shares a woody accord with perfumes you rated highly.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('woody', { selector: 'mark' })).toBeInTheDocument()
    // 칩은 이름표 꼴(첫 글자 대문자) 그대로라, 근거가 된 칩을 같은 말로 알아봅니다
    expect(screen.getByText('Woody', { selector: 'li' })).toHaveAttribute(
      'data-match',
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
                originalName: 'Artisan',
                nameKo: '아티산',
                imageUrl: null,
                reason: '취향 테스트에서 선택한 시트러스 계열과 잘 맞아요.',
                evidenceSource: 'TASTE_TEST',
                evidenceKey: 'CITRUS',
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

  it('움직일 수 있으면 윗칸 띠로 와서 아래 두 칸이 하나씩 내려오고, 다 펴지면 사본을 걷는다', async () => {
    // jsdom 에는 Web Animations 가 없어서, 건 움직임을 받아 두기만 하는 가짜를 답니다
    const started: {
      target: Element
      options?: KeyframeAnimationOptions
      animation: Animation
    }[] = []
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: function (
        this: Element,
        _keyframes: Keyframe[],
        options?: KeyframeAnimationOptions,
      ) {
        const animation = {
          cancel: vi.fn(),
          onfinish: null,
        } as unknown as Animation
        started.push({ target: this, options, animation })
        return animation
      },
    })
    try {
      const user = userEvent.setup()
      const { container } = renderLetter()
      await user.click(
        screen.getByRole('button', { name: '새로 온 향수 편지 열기' }),
      )

      // 진짜 편지는 윗칸만 남기고, 아래 두 칸은 낭독기에서 빠진 사본이 맡습니다
      const letter = screen.getByRole('region', {
        name: '당신을 위한 향수 편지',
      })
      expect(letter).toHaveAttribute('data-folded')
      expect(container.querySelector('.rec-fold')).toHaveAttribute(
        'aria-hidden',
        'true',
      )
      expect(
        screen.getAllByRole('heading', {
          name: '마음에 든 향과 닮은 향수를 찾았어요',
        }),
      ).toHaveLength(1)
      expect(screen.getByRole('button', { name: '편지 접기' })).toHaveFocus()

      // 가운데 칸이 먼저, 아랫칸이 뒤에 내려옵니다
      const delay = (panel: string) =>
        started.find(({ target }) =>
          target.matches(`.rec-fold-panel[data-panel='${panel}']`),
        )?.options?.delay ?? Number.NaN
      expect(delay('middle')).toBeLessThan(delay('bottom'))

      // 편지 상자의 움직임이 끝나면 사본을 걷고 진짜 편지를 다 드러냅니다
      const move = started.find(({ target }) =>
        target.classList.contains('rec-letter'),
      )?.animation
      act(() => {
        move?.onfinish?.call(
          move,
          new Event('finish') as AnimationPlaybackEvent,
        )
      })
      expect(container.querySelector('.rec-fold')).not.toBeInTheDocument()
      expect(letter).not.toHaveAttribute('data-folded')
    } finally {
      Reflect.deleteProperty(Element.prototype, 'animate')
    }
  })

  it('다른 향수를 추천받아도 새 편지가 오지 않으면 한 줄로 알린다 — 줄 향수가 없음 · 묻다 실패', async () => {
    const user = userEvent.setup()
    const onNext =
      vi.fn<() => Promise<PersonalRecommendationResult | undefined>>()
    onNext.mockResolvedValueOnce({ status: 'none' })
    onNext.mockResolvedValueOnce(undefined)
    renderLetter({ onNext })
    await user.click(
      screen.getByRole('button', { name: '새로 온 향수 편지 열기' }),
    )

    await user.click(screen.getByRole('button', { name: '다른 향수 추천받기' }))
    expect(
      await screen.findByText('지금은 새로 보낼 향수가 없어요'),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '지금은 새로 보낼 향수가 없어요',
    )

    await user.click(screen.getByRole('button', { name: '다른 향수 추천받기' }))
    expect(
      await screen.findByText('새 편지를 받지 못했어요. 다시 눌러 주세요'),
    ).toBeInTheDocument()
    // 받아 둔 편지는 그대로 남습니다
    expect(
      screen.getByRole('heading', {
        name: '마음에 든 향과 닮은 향수를 찾았어요',
      }),
    ).toBeInTheDocument()

    // 접으면 한 줄도 지웁니다
    await user.click(screen.getByRole('button', { name: '편지 접기' }))
    await user.click(
      screen.getByRole('button', { name: '향수 편지 다시 열기' }),
    )
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
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
