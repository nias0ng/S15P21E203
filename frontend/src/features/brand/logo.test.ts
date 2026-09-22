import { describe, expect, it } from 'vitest'

import { usableLogoUrl } from './logo'

describe('usableLogoUrl', () => {
  /* 7,872개 중 7,092개가 이 모양입니다 — 토큰이 빠져 401 이 돌아옵니다 */
  it('토큰 없는 logo.dev 주소는 걸러낸다', () => {
    expect(usableLogoUrl('https://img.logo.dev/chanel.com')).toBeNull()
  })

  it('쿼리가 붙어 있어도 logo.dev 면 걸러낸다', () => {
    expect(usableLogoUrl('https://img.logo.dev/chanel.com?size=200')).toBeNull()
  })

  /* logo_override 에서 온 52개 — 지금 화면에 실제로 뜨는 로고는 이것뿐입니다 */
  it('그 밖의 주소는 그대로 통과시킨다', () => {
    const override = 'https://fimgs.net/mdimg/dizajneri/o.4828.jpg'

    expect(usableLogoUrl(override)).toBe(override)
  })

  it('로고가 없는 브랜드(null)는 null 그대로다', () => {
    expect(usableLogoUrl(null)).toBeNull()
  })

  it('주소가 아닌 값은 걸러낸다', () => {
    expect(usableLogoUrl('')).toBeNull()
    expect(usableLogoUrl('img.logo.dev/chanel.com')).toBeNull()
  })
})
