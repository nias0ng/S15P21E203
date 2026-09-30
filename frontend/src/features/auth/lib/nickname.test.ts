import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { useLocaleStore } from '@/shared/store/localeStore'

import { nicknameLengthError } from './nickname'

const RULE = '닉네임은 공백을 제외하고 2~20자입니다'

describe('nicknameLengthError', () => {
  it('비어 있으면 아직 안내하지 않는다', () => {
    expect(nicknameLengthError('')).toBeUndefined()
  })

  it('두 자부터 스무 자까지는 통과한다', () => {
    expect(nicknameLengthError('향해')).toBeUndefined()
    expect(nicknameLengthError('가'.repeat(20))).toBeUndefined()
  })

  it('한 자이거나 스물한 자 이상이면 규칙을 알린다', () => {
    expect(nicknameLengthError('향')).toBe(RULE)
    expect(nicknameLengthError('가'.repeat(21))).toBe(RULE)
  })
})

describe('nicknameLengthError 영어 화면', () => {
  it('규칙을 영어로 알린다', async () => {
    useLocaleStore.getState().setLocale('en')
    await waitFor(() => expect(i18n.language).toBe('en'))

    expect(nicknameLengthError('향')).toBe(
      'Nicknames must be 2–20 characters, not counting spaces',
    )
  })
})
