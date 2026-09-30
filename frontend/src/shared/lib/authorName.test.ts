import { describe, expect, it } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import { authorName } from './authorName'

describe('authorName', () => {
  it('닉네임이 있으면 그대로 적는다', () => {
    expect(authorName('향해')).toBe('향해')
  })

  it('닉네임이 비어 왔으면 탈퇴한 회원으로 적는다', () => {
    expect(authorName(null)).toBe('탈퇴한 회원')
    expect(authorName(undefined)).toBe('탈퇴한 회원')
  })

  it('영어 화면은 영어로 적는다', () => {
    useLocaleStore.getState().setLocale('en')

    expect(authorName(null)).toBe('Former member')
  })

  it('빈 문자열은 닉네임으로 본다', () => {
    expect(authorName('')).toBe('')
  })
})
