import { describe, expect, it } from 'vitest'

import { safeReturnPath, withReturnPath } from './returnPath'

describe('safeReturnPath', () => {
  it('앱 안의 경로는 그대로 돌려준다', () => {
    expect(safeReturnPath('/community/reviews')).toBe('/community/reviews')
  })

  it('쿼리와 해시가 붙은 경로도 그대로 돌려준다', () => {
    expect(safeReturnPath('/community/free?page=3')).toBe(
      '/community/free?page=3',
    )
    expect(safeReturnPath('/notes/5#top')).toBe('/notes/5#top')
  })

  it('값이 없으면 null', () => {
    expect(safeReturnPath(null)).toBeNull()
    expect(safeReturnPath(undefined)).toBeNull()
    expect(safeReturnPath('')).toBeNull()
  })

  it('다른 사이트로 나가는 주소는 받지 않는다', () => {
    expect(safeReturnPath('https://evil.example.com')).toBeNull()
    expect(safeReturnPath('http://evil.example.com')).toBeNull()
    expect(safeReturnPath('//evil.example.com')).toBeNull()
    expect(safeReturnPath('javascript:alert(1)')).toBeNull()
  })

  it('역슬래시로 시작을 위장한 주소도 받지 않는다', () => {
    expect(safeReturnPath('/\\evil.example.com')).toBeNull()
    expect(safeReturnPath('\\\\evil.example.com')).toBeNull()
  })

  it('슬래시로 시작하지 않으면 받지 않는다', () => {
    expect(safeReturnPath('community/reviews')).toBeNull()
    expect(safeReturnPath(' /community/reviews')).toBeNull()
  })
})

describe('withReturnPath', () => {
  it('돌아갈 경로를 쿼리로 달아 준다', () => {
    expect(withReturnPath('/login', '/community/reviews')).toBe(
      '/login?redirectTo=%2Fcommunity%2Freviews',
    )
  })

  it('돌아갈 곳이 없으면 주소를 그대로 둔다', () => {
    expect(withReturnPath('/login', null)).toBe('/login')
    expect(withReturnPath('/signup', undefined)).toBe('/signup')
  })

  it('걸러지는 값은 달지 않는다', () => {
    expect(withReturnPath('/login', 'https://evil.example.com')).toBe('/login')
  })

  it('달아 둔 값을 그대로 다시 읽어 낸다', () => {
    const path = '/community/free?page=3'
    const url = new URL(
      withReturnPath('/login', path),
      'https://hyanghae.example',
    )
    expect(safeReturnPath(url.searchParams.get('redirectTo'))).toBe(path)
  })
})
