import { describe, expect, it } from 'vitest'

import { readOption, readPage, withQueryParams, writePage } from './queryParams'

const params = (init: string) => new URLSearchParams(init)

describe('readOption', () => {
  const SORTS = [
    { value: 'RECENT', label: '최신순' },
    { value: 'LIKES', label: '좋아요순' },
  ] as const

  it('선택지에 있는 값은 그대로 돌려준다', () => {
    expect(readOption('LIKES', SORTS)).toBe('LIKES')
  })

  it('모르는 값은 null — 사람이 고쳐 쓴 주소입니다', () => {
    expect(readOption('foo', SORTS)).toBeNull()
  })

  it('대소문자가 다르면 다른 값으로 본다', () => {
    expect(readOption('likes', SORTS)).toBeNull()
  })

  it('값이 없으면 null', () => {
    expect(readOption(null, SORTS)).toBeNull()
    expect(readOption('', SORTS)).toBeNull()
  })
})

describe('withQueryParams', () => {
  it('값을 넣고, null 이면 뺀다', () => {
    const next = withQueryParams(params('sort=RECENT&keyword=우디'), {
      sort: 'LIKES',
      keyword: null,
    })

    expect(next.get('sort')).toBe('LIKES')
    expect(next.has('keyword')).toBe(false)
  })

  it('빈 문자열도 뺀 것으로 본다 — 검색창을 비운 상태입니다', () => {
    expect(
      withQueryParams(params('keyword=우디'), { keyword: '' }).has('keyword'),
    ).toBe(false)
  })

  it('원본을 건드리지 않는다', () => {
    const before = params('sort=RECENT')
    withQueryParams(before, { sort: 'LIKES' })

    expect(before.get('sort')).toBe('RECENT')
  })

  it('건드리지 않은 값은 그대로 남는다', () => {
    const next = withQueryParams(params('a=1&b=2'), { a: '9' })

    expect(next.get('b')).toBe('2')
  })
})

describe('readPage', () => {
  it('주소는 1부터, 돌려주는 값은 0부터', () => {
    expect(readPage(params('page=1'))).toBe(0)
    expect(readPage(params('page=3'))).toBe(2)
  })

  it('없으면 첫 쪽', () => {
    expect(readPage(params(''))).toBe(0)
  })

  /*
    흩어져 있던 원래 식은 여기서 NaN 을 내놓았고, 그 값이 쿼리 키에 들어가 화면이
    빈 채로 멈췄습니다. 묶으면서 같이 막습니다.
  */
  it('숫자가 아니면 첫 쪽으로 본다', () => {
    expect(readPage(params('page=abc'))).toBe(0)
    expect(readPage(params('page='))).toBe(0)
  })

  it('0 이나 음수도 첫 쪽으로 본다', () => {
    expect(readPage(params('page=0'))).toBe(0)
    expect(readPage(params('page=-5'))).toBe(0)
  })
})

describe('writePage', () => {
  it('0부터 세는 값을 1부터 세는 주소로 적는다', () => {
    expect(writePage(params(''), 2).get('page')).toBe('3')
  })

  /*
    `?page=1` 이 붙은 주소와 안 붙은 주소가 갈리면 같은 화면이 주소 두 개를
    갖게 됩니다.
  */
  it('첫 쪽은 주소에 적지 않는다', () => {
    expect(writePage(params('page=4'), 0).has('page')).toBe(false)
  })

  it('다른 쿼리는 그대로 둔다', () => {
    expect(writePage(params('sort=LIKES'), 1).get('sort')).toBe('LIKES')
  })

  it('적었다 다시 읽으면 같은 값이 나온다', () => {
    for (const page of [0, 1, 7, 42]) {
      expect(readPage(writePage(params(''), page))).toBe(page)
    }
  })
})
