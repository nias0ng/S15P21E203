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

  /*
    아래가 이 함수의 존재 이유입니다. `redirectTo` 는 주소창에 실려 오므로 남이
    만든 링크로도 들어옵니다 — 걸러내지 않으면 `/login?redirectTo=https://…` 한 줄로
    "로그인 직후 남의 사이트로 튕기는" 링크를 만들 수 있습니다.
  */
  it('다른 사이트로 나가는 주소는 받지 않는다', () => {
    expect(safeReturnPath('https://evil.example.com')).toBeNull()
    expect(safeReturnPath('http://evil.example.com')).toBeNull()
    // 프로토콜 없이 시작하는 주소도 바깥으로 나갑니다
    expect(safeReturnPath('//evil.example.com')).toBeNull()
    expect(safeReturnPath('javascript:alert(1)')).toBeNull()
  })

  it('역슬래시로 시작을 위장한 주소도 받지 않는다', () => {
    // 브라우저가 \ 를 / 로 고쳐 읽어서 //evil 과 같아집니다
    expect(safeReturnPath('/\\evil.example.com')).toBeNull()
    expect(safeReturnPath('\\\\evil.example.com')).toBeNull()
  })

  it('슬래시로 시작하지 않으면 받지 않는다', () => {
    expect(safeReturnPath('community/reviews')).toBeNull()
    // 앞에 공백을 붙여 검사를 피하려는 값도 그대로 떨어뜨립니다
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

  /*
    달 때와 읽을 때가 서로 맞는지 — 이 왕복이 깨져 있던 것이 버그의 정체였습니다.
  */
  it('달아 둔 값을 그대로 다시 읽어 낸다', () => {
    const path = '/community/free?page=3'
    const url = new URL(
      withReturnPath('/login', path),
      'https://hyanghae.example',
    )
    expect(safeReturnPath(url.searchParams.get('redirectTo'))).toBe(path)
  })
})
