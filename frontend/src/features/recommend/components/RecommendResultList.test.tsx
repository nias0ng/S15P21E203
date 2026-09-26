import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

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

/** 카드를 펼쳐 둡니다 — 추천 이유는 펼친 카드에만 섭니다 */
const renderExpanded = async (
  reasons: RecommendedPerfume['reasons'],
  {
    query = '빨래 냄새 나는 향수 찾고 있어',
    pickedWithoutScentCondition = false,
  } = {},
) => {
  render(
    <MemoryRouter>
      <RecommendResultList
        perfumes={[perfume(reasons)]}
        query={query}
        pickedWithoutScentCondition={pickedWithoutScentCondition}
      />
    </MemoryRouter>,
  )
  await userEvent.click(
    screen.getByRole('button', { name: /레이지 선데이 모닝/ }),
  )
  return screen.getByRole('listitem')
}

describe('RecommendResultList', () => {
  it('추천 이유를 한 문장으로 그리고, 괄호 안 숫자의 뜻을 머리글에 적는다', async () => {
    const card = await renderExpanded([
      { phrase: '빨래', evidence: 'soapy · fresh', strengths: [100, 93] },
    ])

    expect(
      screen.getByText('추천 이유 · 괄호 안은 향 강도 0~100'),
    ).toBeInTheDocument()
    expect(card).toHaveTextContent(
      '이 향수는 ‘빨래’가 가리키는 비누(100) · 프레시(93) 향을 가지고 있습니다.',
    )
    // 강도는 백분율이 아닙니다 — 100 은 "이 향수에서 가장 세게 잡혔다" 입니다
    expect(card).not.toHaveTextContent('%')
  })

  // 두 배포 사이 — 이 칸을 모르는 서버와 만나면 숫자 없이 문장만 섭니다
  it('강도가 오지 않으면 숫자도 숫자의 뜻도 적지 않는다', async () => {
    const card = await renderExpanded([{ phrase: null, evidence: 'woody' }])

    expect(screen.getByText('추천 이유')).toBeInTheDocument()
    expect(screen.queryByText(/괄호 안은/)).not.toBeInTheDocument()
    expect(card).toHaveTextContent(
      '이 향수는 요청하신 우디 향을 가지고 있습니다.',
    )
  })

  // LLM 단계가 '우드향' 을 풀어 쓴 말이 표현 칸에 옵니다 (실측)
  it('사용자가 쓰지 않은 말은 표현으로 옮기지 않는다', async () => {
    const card = await renderExpanded(
      [{ phrase: 'woody', evidence: 'woody', strengths: [100] }],
      { query: '가을에 쓸 남성적인 우드향 추천해줘.' },
    )

    expect(card).toHaveTextContent(
      '이 향수는 요청하신 우디(100) 향을 가지고 있습니다.',
    )
    expect(card).not.toHaveTextContent('woody')
  })

  it('향으로 고른 것이 아니면 조건에 맞는다고만 적는다', async () => {
    const card = await renderExpanded(
      [{ phrase: null, evidence: '남성적인 · 가을에 어울리는' }],
      { pickedWithoutScentCondition: true },
    )

    expect(card).toHaveTextContent(
      '요청하신 남성적인 · 가을에 어울리는 조건에 맞는 향수입니다.',
    )
    expect(card).not.toHaveTextContent('향을 가지고 있습니다')
  })
})
