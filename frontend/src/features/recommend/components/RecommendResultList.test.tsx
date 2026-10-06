import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useTourStore } from '@/shared/store/tourStore'

import type { RecommendedPerfume } from '../types'

import { RecommendResultList } from './RecommendResultList'

const perfume = (
  reasons: RecommendedPerfume['reasons'],
): RecommendedPerfume => ({
  perfumeId: 1,
  name: '레이지 선데이 모닝',
  brand: '메종 마르지엘라',
  thumbnailUrl: null,
  reasons,
})

const renderList = ({
  reasons = [
    { phrase: null, evidence: 'woody' },
  ] as RecommendedPerfume['reasons'],
  query = '빨래 냄새 나는 향수 찾고 있어',
  pickedWithoutScentCondition = false,
} = {}) =>
  render(
    <MemoryRouter>
      <RecommendResultList
        perfumes={[perfume(reasons)]}
        query={query}
        pickedWithoutScentCondition={pickedWithoutScentCondition}
      />
    </MemoryRouter>,
  )

const card = () => screen.getByRole('button', { name: /레이지 선데이 모닝/ })

/** 카드를 눌러 추천 이유 칸을 엽니다 — 이유는 누른 카드의 것만 섭니다 */
const openReasons = async (
  reasons: RecommendedPerfume['reasons'],
  options: { query?: string; pickedWithoutScentCondition?: boolean } = {},
) => {
  renderList({ reasons, ...options })
  await userEvent.click(card())
  return screen.getByRole('region', { name: /추천 이유/ })
}

beforeEach(() => {
  localStorage.clear()
  useTourStore.setState({ done: [], off: false, wanted: [], active: null })
})

describe('RecommendResultList', () => {
  it('카드를 누르면 이유와 상세로 가는 [자세히 보기]가 열리고, 다시 누르면 닫힌다', async () => {
    renderList()

    expect(card()).toHaveTextContent('추천 1위')
    expect(
      screen.queryByRole('region', { name: /추천 이유/ }),
    ).not.toBeInTheDocument()

    await userEvent.click(card())
    expect(card()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: '자세히 보기' })).toHaveAttribute(
      'href',
      '/perfumes/1',
    )

    await userEvent.click(card())
    expect(
      screen.queryByRole('region', { name: /추천 이유/ }),
    ).not.toBeInTheDocument()
  })

  it('추천 이유를 한 문장으로 그리고, 괄호 안 숫자의 뜻을 머리글에 적는다', async () => {
    const reasonsBox = await openReasons([
      { phrase: '빨래', evidence: 'soapy · fresh', strengths: [100, 93] },
    ])

    expect(
      screen.getByText('추천 이유 · 괄호 안은 향 강도 0~100'),
    ).toBeInTheDocument()
    expect(reasonsBox).toHaveTextContent(
      '이 향수는 ‘빨래’가 가리키는 비누(100) · 프레시(93) 향을 가지고 있습니다.',
    )
    // 강도는 백분율이 아닙니다 — 100 은 "이 향수에서 가장 세게 잡혔다" 입니다
    expect(reasonsBox).not.toHaveTextContent('%')
  })

  // 두 배포 사이 — 이 칸을 모르는 서버와 만나면 숫자 없이 문장만 섭니다
  it('강도가 오지 않으면 숫자도 숫자의 뜻도 적지 않는다', async () => {
    const reasonsBox = await openReasons([{ phrase: null, evidence: 'woody' }])

    expect(screen.getByText('추천 이유')).toBeInTheDocument()
    expect(screen.queryByText(/괄호 안은/)).not.toBeInTheDocument()
    expect(reasonsBox).toHaveTextContent(
      '이 향수는 요청하신 우디 향을 가지고 있습니다.',
    )
  })

  // LLM 단계가 '우드향' 을 풀어 쓴 말이 표현 칸에 옵니다 (실측)
  it('사용자가 쓰지 않은 말은 표현으로 옮기지 않는다', async () => {
    const reasonsBox = await openReasons(
      [{ phrase: 'woody', evidence: 'woody', strengths: [100] }],
      { query: '가을에 쓸 남성적인 우드향 추천해줘.' },
    )

    expect(reasonsBox).toHaveTextContent(
      '이 향수는 요청하신 우디(100) 향을 가지고 있습니다.',
    )
    expect(reasonsBox).not.toHaveTextContent('woody')
  })

  it('향으로 고른 것이 아니면 조건에 맞는다고만 적는다', async () => {
    const reasonsBox = await openReasons(
      [{ phrase: null, evidence: '남성적인 · 가을에 어울리는' }],
      { pickedWithoutScentCondition: true },
    )

    expect(reasonsBox).toHaveTextContent(
      '요청하신 남성적인 · 가을에 어울리는 조건에 맞는 향수입니다.',
    )
    expect(reasonsBox).not.toHaveTextContent('향을 가지고 있습니다')
  })

  // 처음 온 사람은 카드가 상세로 가는 링크인 줄 알고 이유를 펼쳐 보지 않았습니다 (메인 사용성 테스트)
  it('처음 받은 결과에서는 이유가 설 자리에 카드를 눌러 보라고 적고, 하나를 펼치면 끝난다', async () => {
    renderList()

    expect(screen.getByRole('status')).toHaveTextContent(
      '카드를 누르면 왜 골랐는지 아래에 펼쳐져요.',
    )

    await userEvent.click(card())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(useTourStore.getState().done).toContain('results')

    // 접어도 다시 서지 않습니다
    await userEvent.click(card())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // 메인의 `TourSpotlight` 가 안내 동안 밝혀 두는 자리 — 안내 자신이 아니라 안내가 말하는 카드들입니다
  it('결과 안내가 가리키는 카드 격자에 표시를 단다', () => {
    renderList()

    const grid = screen.getByRole('list')
    expect(grid).toHaveAttribute('data-tour-target', 'results')
    expect(grid).toContainElement(card())
    expect(grid).not.toContainElement(screen.getByRole('status'))
  })
})
