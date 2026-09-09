import { describe, expect, it } from 'vitest'

import { cn } from './cn'

/**
 * `@theme` 에 추가한 토큰은 tailwind-merge 가 어느 속성인지 모릅니다.
 * 등록해 두지 않으면 충돌을 못 걸러서 두 클래스가 다 남고, 어느 쪽이 이길지는
 * CSS 출력 순서가 정합니다 — 호출하는 쪽에서 예측할 수 없습니다.
 *
 * `styles/index.css` 에 토큰을 추가할 때 `cn.ts` 등록을 빠뜨리면 여기서 걸립니다.
 */
describe('cn', () => {
  it('기본 스케일끼리 충돌하면 뒤에 온 것만 남긴다', () => {
    expect(cn('px-4 py-2', 'px-8')).toBe('py-2 px-8')
  })

  it('우리가 추가한 글자 크기 토큰도 충돌로 인식한다', () => {
    expect(cn('text-body', 'text-caption')).toBe('text-caption')
    expect(cn('text-heading', 'text-display')).toBe('text-display')
  })

  it('우리 토큰과 Tailwind 기본 크기가 섞여도 하나만 남는다', () => {
    expect(cn('text-body', 'text-base')).toBe('text-base')
    expect(cn('text-sm', 'text-title')).toBe('text-title')
  })

  it('우리가 추가한 그림자 토큰도 충돌로 인식한다', () => {
    expect(cn('shadow-raised', 'shadow-modal')).toBe('shadow-modal')
  })

  it('글자 크기와 글자 색은 서로 다른 속성이라 둘 다 남는다', () => {
    expect(cn('text-body', 'text-ink-muted')).toBe('text-body text-ink-muted')
  })
})
