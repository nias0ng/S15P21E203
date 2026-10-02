import { describe, expect, it } from 'vitest'

import { searchWords } from './searchWords'

describe('searchWords', () => {
  it('문장에서 이름 · 브랜드 낱말만 남긴다', () => {
    expect(
      searchWords('아쿠아디파르마 미르토 디 파나레아와 비슷한 향수'),
    ).toEqual(['아쿠아디파르마', '미르토', '디', '파나레아'])
  })

  // 두 글자 이름의 끝 글자가 조사처럼 생겼어도 자르지 않습니다
  it('두 글자 낱말의 끝은 떼지 않는다', () => {
    expect(searchWords('아리')).toEqual(['아리'])
    expect(searchWords('로즈')).toEqual(['로즈'])
  })
})
