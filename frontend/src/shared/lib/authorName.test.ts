import { describe, expect, it } from 'vitest'

import { authorName } from './authorName'

describe('authorName', () => {
  it('닉네임이 있으면 그대로 적는다', () => {
    expect(authorName('향해')).toBe('향해')
  })

  it('닉네임이 비어 왔으면 탈퇴한 회원으로 적는다', () => {
    expect(authorName(null)).toBe('탈퇴한 회원')
    expect(authorName(undefined)).toBe('탈퇴한 회원')
  })

  /*
    지금 다섯 곳이 `??` 로 적어 빈 문자열은 그대로 둡니다. 서버가 빈 닉네임을 주지 않아
    생기지 않는 일이지만, 규칙을 옮기면서 바꾸지 않았다는 것을 적어 둡니다.
  */
  it('빈 문자열은 닉네임으로 본다', () => {
    expect(authorName('')).toBe('')
  })
})
