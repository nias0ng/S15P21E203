import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import type { CollectionSummary } from '../types'

import { CollectionStrip } from './CollectionStrip'

const COMMUTE: CollectionSummary = {
  collectionId: 7,
  title: '출근할 때',
  description: '아침에 한 번 뿌리는 향',
  perfumeCount: 4,
  previewThumbnails: ['/bottles/a.webp', null, '/bottles/c.webp'],
}

/** 넘기지 않은 콜백은 vi.fn() 으로 채웁니다 — 검사할 것만 넘기면 됩니다 */
function renderStrip(props: Partial<Parameters<typeof CollectionStrip>[0]>) {
  // 진열함이 링크라 라우터 안에서 그려야 합니다
  return render(
    <MemoryRouter>
      <CollectionStrip items={[]} onCreate={vi.fn()} {...props} />
    </MemoryRouter>,
  )
}

describe('CollectionStrip 진열함', () => {
  it('컬렉션마다 상세로 가는 진열함 하나를 세우고 이름 · 개수 · 설명을 적는다', () => {
    renderStrip({ items: [COMMUTE] })

    const link = screen.getByRole('link', { name: /출근할 때/ })
    expect(link).toHaveAttribute('href', '/collections/7')
    expect(link).toHaveTextContent('향수 4개 · 아침에 한 번 뿌리는 향')
  })

  it('미리보기 사진만큼 병을 세운다 — 사진이 없는 향수는 사진 대신 실루엣이다', () => {
    renderStrip({ items: [COMMUTE] })

    // 병 사진은 옆에 이름이 적혀 있어 장식(alt="")입니다 — 역할이 presentation 입니다
    expect(screen.getAllByRole('presentation')).toHaveLength(2)
  })

  it('향수를 다 뺀 컬렉션은 비어 있다고 적는다', () => {
    renderStrip({
      items: [{ ...COMMUTE, perfumeCount: 0, previewThumbnails: [] }],
    })

    expect(screen.getByText('아직 담긴 향수가 없어요')).toBeInTheDocument()
  })

  it('마지막 칸의 빈 진열함을 누르면 새 컬렉션을 만든다', async () => {
    const onCreate = vi.fn()
    renderStrip({ items: [COMMUTE], onCreate })

    await userEvent.click(screen.getByRole('button', { name: /새 컬렉션/ }))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('컬렉션이 하나도 없으면 첫 컬렉션을 만들자고 한다', () => {
    renderStrip({ items: [] })

    expect(
      screen.getByRole('button', { name: /첫 컬렉션 만들기/ }),
    ).toBeInTheDocument()
  })
})

describe('CollectionStrip 받는 중 · 실패', () => {
  it('받는 동안에는 누를 것을 세우지 않는다', () => {
    renderStrip({ items: [COMMUTE], isPending: true })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('못 받았으면 "없다" 가 아니라 못 불러왔다고 적고 다시 부른다', async () => {
    const onRetry = vi.fn()
    renderStrip({ isError: true, onRetry })

    expect(screen.getByText('컬렉션을 불러오지 못했습니다')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /새 컬렉션/ }),
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('CollectionStrip 영어 화면', () => {
  it('개수를 복수형으로 적고 새 컬렉션 칸도 영어로 적는다', () => {
    useLocaleStore.getState().setLocale('en')
    renderStrip({
      items: [COMMUTE, { ...COMMUTE, collectionId: 8, perfumeCount: 1 }],
    })

    const [four, one] = screen.getAllByRole('link')
    expect(four).toHaveTextContent('4 perfumes · 아침에 한 번 뿌리는 향')
    expect(one).toHaveTextContent('1 perfume · 아침에 한 번 뿌리는 향')
    expect(
      screen.getByRole('button', { name: /New collection/ }),
    ).toBeInTheDocument()
  })
})
