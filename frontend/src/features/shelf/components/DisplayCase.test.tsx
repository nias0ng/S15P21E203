import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ShelfItem } from '../types'

import { DisplayCase } from './DisplayCase'

const WOOD_SAGE: ShelfItem = {
  shelfItemId: 1,
  perfumeId: 1,
  name: '조 말론 우드 세이지 앤 씨 솔트',
  brand: '조말론',
  brandEn: 'Jo Malone',
  nameEn: 'Wood Sage & Sea Salt',
  concentration: 'Eau de Cologne',
  thumbnailUrl: null,
  category: 'OWNED',
  representative: true,
  rating: null,
  memo: null,
  memoUpdatedAt: null,
}

/** 이름이 다른 병 셋 — 칸 0 · 1 · 2 */
const THREE: ShelfItem[] = [
  { ...WOOD_SAGE, shelfItemId: 1, perfumeId: 1, name: '우드 세이지' },
  { ...WOOD_SAGE, shelfItemId: 2, perfumeId: 2, name: '블랙베리 앤 베이' },
  { ...WOOD_SAGE, shelfItemId: 3, perfumeId: 3, name: '라임 바질' },
]

const renderCase = (
  items: ShelfItem[],
  bounds: Partial<{
    winFrom: number
    winTo: number
    edgeFrom: number
    priorityFrom: number
    priorityTo: number
    priorityId: number | null
  }> = {},
) =>
  render(
    <DisplayCase
      items={items}
      span={items.length}
      selectedId={null}
      onSelect={vi.fn()}
      // 벽감 전체가 창 안에 서 있고, 첫 화면입니다
      winFrom={0}
      winTo={items.length}
      edgeFrom={items.length}
      priorityFrom={0}
      priorityTo={items.length}
      priorityId={null}
      emptyMessage="비어 있음"
      {...bounds}
    />,
  )

const bottle = (name: string) =>
  screen.getByRole('button', { name: `조말론 ${name}`, hidden: true })

describe('DisplayCase 이름표', () => {
  it('영문 줄은 화면에만 적고, 병 단추는 한글 브랜드 + 한글 이름으로 읽힌다', () => {
    renderCase([WOOD_SAGE])
    expect(
      screen.getByRole('button', { name: '조말론 우드 세이지 앤 씨 솔트' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Jo Malone')).toBeInTheDocument()
    expect(screen.getByText('Wood Sage & Sea Salt')).toBeInTheDocument()
    expect(screen.getByText('Eau de Cologne')).toBeInTheDocument()
  })

  it('영문 줄이 없으면(백엔드가 아직 주지 않음) 한글 브랜드를 한 번만 적고 빈 줄을 두지 않는다', () => {
    renderCase([
      {
        ...WOOD_SAGE,
        brandEn: undefined,
        nameEn: undefined,
        concentration: undefined,
      },
    ])
    expect(
      screen.getByRole('button', { name: '조말론 우드 세이지 앤 씨 솔트' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('조말론')).toHaveLength(1)
    expect(screen.queryByText('Jo Malone')).not.toBeInTheDocument()
  })
})

describe('DisplayCase 창 밖 병', () => {
  it('창 밖 병과 창 끝에 걸려 지운 병은 탭 순서 · 낭독기에서 빠진다(inert)', () => {
    // 창이 칸 1 에서 시작해 칸 2 까지 걸치고, 칸 2 가 창 오른쪽 끝에 걸렸습니다
    renderCase(THREE, { winFrom: 1, winTo: 3, edgeFrom: 2 })
    expect(bottle('우드 세이지')).toHaveAttribute('inert')
    expect(bottle('블랙베리 앤 베이')).not.toHaveAttribute('inert')
    expect(bottle('라임 바질')).toHaveAttribute('inert')
  })
})

describe('DisplayCase 사진 받기', () => {
  const photos = THREE.map((item, at) => ({
    ...item,
    thumbnailUrl: `/bottles/${at}.png`,
  }))

  it('첫 화면 병 사진은 먼저 받아 그 자리에서 풀고, 나머지는 뒤에 받는다 — lazy 는 쓰지 않는다', () => {
    const { container } = renderCase(photos, {
      priorityFrom: 0,
      priorityTo: 0,
      priorityId: 3,
    })
    const images = [...container.querySelectorAll('img')]
    expect(images).toHaveLength(3)
    expect(
      images.map((img) => [
        img.getAttribute('fetchpriority'),
        img.getAttribute('decoding'),
        img.getAttribute('loading'),
      ]),
    ).toEqual([
      ['high', 'sync', 'eager'],
      ['low', 'async', 'eager'],
      // 첫 화면을 그릴 때 고른 병
      ['high', 'sync', 'eager'],
    ])
  })
})
