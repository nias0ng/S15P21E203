import { describe, expect, it } from 'vitest'

import { cn } from '@/shared/lib/cn'

import { CARD_GRID } from './cardGrid'

describe('CARD_GRID', () => {
  /* 여섯 열 자리는 덮어서 씁니다 — 다섯 열이 같이 남으면 CSS 순서로 한쪽이 이깁니다 */
  it('여섯 열로 덮으면 다섯 열이 걷힌다', () => {
    const sixColumns = cn(CARD_GRID, 'lg:grid-cols-6').split(' ')

    expect(sixColumns).toContain('lg:grid-cols-6')
    expect(sixColumns).not.toContain('lg:grid-cols-5')
    expect(sixColumns).toContain('sm:grid-cols-3')
  })
})
