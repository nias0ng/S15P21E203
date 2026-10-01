import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import type { VoyageLogEntry } from '../types'

import { VoyageLog } from './VoyageLog'

/*
 * '오늘' 은 지금 시각으로 가르므로 날짜만 고정합니다 — 판이 열리는 두 프레임(requestAnimationFrame)은
 * 그대로 돌아야 해서 시계 전체를 멈추지 않습니다.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
  // jsdom 에는 matchMedia 가 없습니다. 넓은 창이라 판이 펼친 채로 시작합니다
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const at = (month: number, date: number, hour: number) =>
  new Date(2026, month - 1, date, hour).toISOString()

/** 어제 — 들르기만 하고 향수는 안 본 해역 */
const PASSED_BY: VoyageLogEntry = {
  entryId: 1,
  enteredAt: at(9, 22, 17),
  scentRegionId: 1,
  region: 'FLORAL',
  visited: [],
}

const ENTRIES: VoyageLogEntry[] = [
  {
    entryId: 3,
    enteredAt: at(9, 23, 11),
    scentRegionId: 3,
    region: 'WOODY',
    visited: [{ perfumeId: 28, name: '코코 마드모아젤' }],
  },
  {
    entryId: 2,
    enteredAt: at(9, 23, 10),
    scentRegionId: 4,
    region: 'CITRUS',
    visited: [{ perfumeId: 6, name: '아쿠아 디 파르마 콜로니아' }],
  },
  PASSED_BY,
]

const renderLog = (entries = ENTRIES) =>
  render(
    <MemoryRouter>
      <VoyageLog entries={entries} status="ready" />
    </MemoryRouter>,
  )

/** 날 머리말들 — 이름이 곧 날짜입니다 */
const dayHeadings = () => screen.getAllByRole('heading', { level: 3 })

describe('VoyageLog', () => {
  it('날짜는 날마다 한 번만 머리말로 달고, 오늘은 "오늘" 로 적는다', () => {
    renderLog()

    const headings = dayHeadings()
    expect(headings).toHaveLength(2)
    expect(headings[0]).toHaveAccessibleName('오늘')
    expect(headings[1]).toHaveAccessibleName('09.22')
  })

  it('머리말에는 날짜만 둔다 — 기호 · 숫자를 붙이지 않는다', () => {
    renderLog()

    expect(screen.getByRole('heading', { name: '오늘' })).toHaveTextContent(
      /^오늘$/,
    )
    expect(screen.getByRole('heading', { name: '09.22' })).toHaveTextContent(
      /^09\.22$/,
    )
  })

  it('그날의 해역과 향수를 따로 적는다 — 해역은 뱃지, 향수는 한 줄씩', () => {
    renderLog()

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(
      ['지나온 해역', '발견한 향수', '지나온 해역'],
    )

    const [todayRegions, todayPerfumes, yesterdayRegions] =
      screen.getAllByRole('definition')
    expect(
      within(todayRegions as HTMLElement)
        .getAllByRole('listitem')
        .map((chip) => chip.textContent),
    ).toEqual(['우디', '시트러스'])
    expect(yesterdayRegions).toHaveTextContent('플로럴')

    // 두 해역에서 본 향수가 오늘의 향수 칸 하나에 최근 순으로 모인다
    const perfumes = screen.getAllByRole('link')
    expect(perfumes.map((link) => link.textContent)).toEqual([
      '코코 마드모아젤',
      '아쿠아 디 파르마 콜로니아',
    ])
    for (const link of perfumes) expect(todayPerfumes).toContainElement(link)
    expect(perfumes[0]).toHaveAttribute('href', '/perfumes/28')
  })

  it('향수는 짧은 이름으로 적고, 올리면 줄이지 않은 이름과 브랜드가 보인다', () => {
    renderLog([
      {
        entryId: 9,
        enteredAt: at(9, 23, 9),
        scentRegionId: 1,
        region: 'FLORAL',
        visited: [
          {
            perfumeId: 11,
            name: '미스 디올',
            fullName: '미스 디올 오 드 퍼퓸 (2021)',
            brand: '디올',
            family: 'FLORAL',
          },
        ],
      },
    ])

    expect(screen.getByRole('link', { name: '미스 디올' })).toHaveAttribute(
      'title',
      '미스 디올 오 드 퍼퓸 (2021) · 디올',
    )
  })

  it('영어 화면은 문구를 영어로, 향수는 원명으로 적는다', () => {
    useLocaleStore.getState().setLocale('en')
    renderLog([
      {
        entryId: 9,
        enteredAt: at(9, 23, 9),
        scentRegionId: 1,
        region: 'FLORAL',
        visited: [
          {
            perfumeId: 11,
            name: '미스 디올',
            fullName: '미스 디올 오 드 퍼퓸 (2021)',
            brand: '디올',
            nameEn: 'Miss Dior Eau de Parfum (2021)',
            brandEn: 'Dior',
            family: 'FLORAL',
          },
          // 지도에서 못 찾은 향수 — API 의 DB 원명 그대로입니다
          { perfumeId: 12, name: 'Unknown Perfume', nameKo: '모르는 향수' },
        ],
      },
    ])

    expect(
      screen.getByRole('region', { name: 'Voyage Log' }),
    ).toBeInTheDocument()
    expect(dayHeadings()[0]).toHaveAccessibleName('Today')
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(
      ['Waters sailed', 'Perfumes found'],
    )
    expect(
      screen.getByRole('link', { name: 'Miss Dior Eau de Parfum (2021)' }),
    ).toHaveAttribute('title', 'Miss Dior Eau de Parfum (2021) · Dior')
    expect(
      screen.getByRole('link', { name: 'Unknown Perfume' }),
    ).toBeInTheDocument()
  })

  it('지도에서 못 찾은 향수는 한국어 화면에서 API 의 한국어 이름을 쓴다', () => {
    renderLog([
      {
        entryId: 9,
        enteredAt: at(9, 23, 9),
        scentRegionId: 1,
        region: 'FLORAL',
        visited: [
          // 한국어 이름이 없으면 원명입니다
          { perfumeId: 13, name: 'Nameless', nameKo: null },
          { perfumeId: 12, name: 'Unknown Perfume', nameKo: '모르는 향수' },
        ],
      },
    ])

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(
      ['모르는 향수', 'Nameless'],
    )
  })

  it('들른 향수가 없는 날은 향수 칸을 두지 않는다', () => {
    renderLog([PASSED_BY])

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(
      ['지나온 해역'],
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('일지가 비어 있으면 안내 한 줄을 띄운다', () => {
    renderLog([])

    expect(screen.getByText('아직 들어간 해역이 없습니다')).toBeInTheDocument()
  })

  it('날은 최근 나흘까지만 싣는다', () => {
    renderLog(
      [23, 22, 21, 20, 19].map((date, index): VoyageLogEntry => ({
        entryId: 50 - index,
        enteredAt: at(9, date, 12),
        scentRegionId: 1,
        region: 'FLORAL',
        visited: [],
      })),
    )

    const headings = dayHeadings()
    expect(headings).toHaveLength(4)
    ;['오늘', '09.22', '09.21', '09.20'].forEach((label, index) =>
      expect(headings[index]).toHaveAccessibleName(label),
    )
  })

  it('가장 최근 날만 펼친 채 시작하고, 지난날은 머리말 한 줄로 접혀 있다', () => {
    renderLog()

    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('button', { name: '09.22' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('날 머리말을 누르면 그날만 접히고 펴진다', async () => {
    const user = userEvent.setup()
    renderLog()

    const today = screen.getByRole('button', { name: '오늘' })
    const yesterday = screen.getByRole('button', { name: '09.22' })

    await user.click(today)
    expect(today).toHaveAttribute('aria-expanded', 'false')

    await user.click(yesterday)
    expect(yesterday).toHaveAttribute('aria-expanded', 'true')
    expect(today).toHaveAttribute('aria-expanded', 'false')

    await user.click(today)
    expect(today).toHaveAttribute('aria-expanded', 'true')
  })
})

/**
 * 오늘 — 해역 일곱 곳을 돌며 곳마다 향수를 하나씩 봤습니다(최근 것부터).
 * 하루에 넷씩만 보이므로 해역 셋 · 향수 셋이 '…' 뒤로 갑니다.
 */
const BUSY_DAY: VoyageLogEntry[] = (
  ['AMBER', 'WOODY', 'AQUATIC', 'GREEN', 'FLORAL', 'FRUITY', 'CITRUS'] as const
).map((region, index) => ({
  entryId: 100 - index,
  enteredAt: at(9, 23, 20 - index),
  scentRegionId: index + 1,
  region,
  visited: [{ perfumeId: index + 1, name: `향수 ${index + 1}` }],
}))

describe('VoyageLog — 넷 넘는 해역 · 향수', () => {
  it('최근 넷만 보이고 나머지는 … 뒤로 가린다', () => {
    renderLog(BUSY_DAY)

    const [regions] = screen.getAllByRole('definition')
    expect(
      within(regions as HTMLElement)
        .getAllByRole('listitem')
        .map((chip) => chip.textContent),
    ).toEqual(['앰버', '우디', '아쿠아틱', '그린', '…'])
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(
      ['향수 1', '향수 2', '향수 3', '향수 4'],
    )
    expect(
      screen.getByRole('button', { name: '해역 3곳 더 보기' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByRole('button', { name: '향수 3개 더 보기' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('넷이 안 되면 … 을 붙이지 않는다', () => {
    renderLog()

    expect(
      screen.queryByRole('button', { name: /더 보기/ }),
    ).not.toBeInTheDocument()
  })

  it('… 에 마우스를 올리면 가린 나머지를 띄우고, 내리면 닫는다', async () => {
    const user = userEvent.setup()
    renderLog(BUSY_DAY)

    const moreRegions = screen.getByRole('button', { name: '해역 3곳 더 보기' })
    // 가려진 셋은 카드에만 있습니다
    expect(screen.queryByText('프루티')).not.toBeInTheDocument()

    await user.hover(moreRegions)
    expect(moreRegions).toHaveAttribute('aria-expanded', 'true')
    for (const name of ['플로럴', '프루티', '시트러스']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }

    await user.unhover(moreRegions)
    await waitFor(() =>
      expect(moreRegions).toHaveAttribute('aria-expanded', 'false'),
    )
    expect(screen.queryByText('프루티')).not.toBeInTheDocument()
  })

  it('가린 향수도 눌러 상세로 갈 수 있다', async () => {
    const user = userEvent.setup()
    renderLog(BUSY_DAY)

    await user.hover(screen.getByRole('button', { name: '향수 3개 더 보기' }))

    expect(screen.getByRole('link', { name: '향수 6' })).toHaveAttribute(
      'href',
      '/perfumes/6',
    )
    expect(screen.getByRole('link', { name: '향수 7' })).toHaveAttribute(
      'href',
      '/perfumes/7',
    )
  })

  it('손가락은 올려 둘 수 없어 누를 때마다 열고 닫는다', async () => {
    const user = userEvent.setup()
    renderLog(BUSY_DAY)

    const moreRegions = screen.getByRole('button', { name: '해역 3곳 더 보기' })
    await user.pointer({ keys: '[TouchA]', target: moreRegions })
    expect(moreRegions).toHaveAttribute('aria-expanded', 'true')

    await user.pointer({ keys: '[TouchA]', target: moreRegions })
    expect(moreRegions).toHaveAttribute('aria-expanded', 'false')
  })

  it('마우스가 없어도 연다 — Enter 로 열고 Esc 로 닫으면 … 으로 돌아온다', async () => {
    const user = userEvent.setup()
    renderLog(BUSY_DAY)

    const moreRegions = screen.getByRole('button', { name: '해역 3곳 더 보기' })
    moreRegions.focus()

    await user.keyboard('{Enter}')
    expect(moreRegions).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(moreRegions).toHaveAttribute('aria-expanded', 'false')
    expect(moreRegions).toHaveFocus()
  })
})
