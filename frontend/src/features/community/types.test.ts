import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { boardTitle } from './types'

describe('boardTitle', () => {
  it('정렬을 수식어로 앞에 붙인다', () => {
    expect(boardTitle('RECENT', '후기')).toBe('최근 후기')
    expect(boardTitle('VIEWS', '후기')).toBe('많이 본 후기')
    expect(boardTitle('LIKES', '글')).toBe('좋아요 많은 글')
    expect(boardTitle('COMMENTS', '글')).toBe('댓글 많은 글')
  })

  it('분류가 있으면 정렬과 이름 사이에 끼운다', () => {
    expect(boardTitle('LIKES', '글', '컬렉션 공유')).toBe(
      '좋아요 많은 컬렉션 공유 글',
    )
    expect(boardTitle('RECENT', '글', '잡담')).toBe('최근 잡담 글')
  })

  it('분류가 없으면 자리를 비우지 않는다', () => {
    expect(boardTitle('RECENT', '글', undefined)).toBe('최근 글')
  })

  it('영어 화면은 정렬 수식어를 영어로 붙인다', async () => {
    await i18n.changeLanguage('en')

    expect(boardTitle('RECENT', 'reviews')).toBe('Recent reviews')
    expect(boardTitle('LIKES', 'posts', 'collection')).toBe(
      'Most liked collection posts',
    )
  })
})
