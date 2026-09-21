import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  perfumeViewState,
  type PerfumeViewSource,
} from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'

import PerfumeDetailPage from './PerfumeDetailPage'

const PERFUME_ID = 7

const detail = {
  perfumeId: PERFUME_ID,
  name: 'Eau Rose',
  nameKo: '오 로즈',
  gender: 'FEMALE',
  concentration: 'EDT',
  brand: { brandId: 1, name: 'Diptyque' },
  images: [],
  prices: [],
  myReviewId: null,
}

/*
  상세 한 건만 답하게 하고 나머지(향조 · 후기 · 통계 …)는 그대로 둡니다 — 각자
  자리표시자를 그리므로 뒤로 가기 단추를 보는 데 지장이 없습니다.
*/
const api = vi.hoisted(() => ({ getPerfumeDetail: vi.fn() }))

vi.mock('@/features/perfume/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

/** 지금 어느 주소에 서 있는지 시험이 볼 수 있게 적어 둡니다 */
function Origin({ label }: { label: string }) {
  const { pathname, search } = useLocation()
  return <div>{`${label} ${pathname}${search}`}</div>
}

const renderFrom = (source: PerfumeViewSource | null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter
        initialEntries={[
          { pathname: ROUTES.PERFUMES, search: '?gender=FEMALE' },
          {
            pathname: toPerfumeDetail(PERFUME_ID),
            state: source === null ? undefined : perfumeViewState(source),
          },
        ]}
        initialIndex={1}
      >
        <Routes>
          <Route path={ROUTES.PERFUMES} element={<Origin label="목록" />} />
          <Route path={ROUTES.MY_SHELF} element={<Origin label="진열대" />} />
          <Route path={ROUTES.PERFUME_DETAIL} element={<PerfumeDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  api.getPerfumeDetail.mockReset().mockResolvedValue(detail)
})

describe('향수 상세 뒤로 가기 (S15P21E203-361)', () => {
  it.each([
    ['SHELF', '← 진열대'],
    ['COMMUNITY', '← 커뮤니티'],
    ['COLLECTION', '← 컬렉션'],
    ['SCENT_MAP', '← 향 지도'],
    ['RELATED_PERFUME', '← 이전 향수'],
  ] as const)('%s 에서 들어오면 이름표가 "%s" 다', async (source, label) => {
    renderFrom(source)

    expect(await screen.findByRole('button', { name: label })).toBeVisible()
  })

  /*
    이 이슈의 핵심입니다. 앞 기록으로 한 칸 되돌리므로 목록이 걸고 있던 `?gender=`
    까지 그대로 돌아와야 합니다. 주소를 새로 지으면 여기서 필터가 떨어집니다.
  */
  it('되돌아간 화면은 걸고 있던 필터를 그대로 갖고 있다', async () => {
    const user = userEvent.setup()
    renderFrom('SEARCH')

    await user.click(await screen.findByRole('button', { name: '← 향수 목록' }))

    expect(
      await screen.findByText('목록 /perfumes?gender=FEMALE'),
    ).toBeVisible()
  })

  /*
    주소를 붙여 넣거나 새로 고치면 state 가 비어 `DIRECT` 입니다. 돌아갈 기록이
    없으므로 한 칸 되돌리면 서비스 밖으로 나갑니다 — 링크로 향수 목록에 보냅니다.
  */
  it('들어온 길을 모르면 향수 목록으로 가는 링크다', async () => {
    renderFrom(null)

    const back = await screen.findByRole('link', { name: '← 향수 목록' })

    expect(back).toHaveAttribute('href', ROUTES.PERFUMES)
    expect(screen.queryByRole('button', { name: /←/ })).not.toBeInTheDocument()
  })
})
