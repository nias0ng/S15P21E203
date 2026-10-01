import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { useLocaleStore } from '@/shared/store/localeStore'

import { googleErrorMessage } from './googleErrors'

describe('googleErrorMessage', () => {
  it('코드가 없으면 아무것도 보여 주지 않는다', () => {
    expect(googleErrorMessage(null)).toBeNull()
    expect(googleErrorMessage('')).toBeNull()
  })

  it('아는 코드는 그 문구를 보여 준다', () => {
    expect(googleErrorMessage('AUTH_EMAIL_REGISTERED_WITH_PASSWORD')).toMatch(
      /이미 이메일로 가입된 계정/,
    )
  })

  // 주소는 누구나 고쳐 보낼 수 있습니다. 모르는 값을 그대로 화면에 띄우지 않습니다.
  it('모르는 값은 그대로 띄우지 않고 일반 문구로 바꾼다', () => {
    expect(googleErrorMessage('<b>계정이 정지됐습니다</b>')).toBe(
      'Google 로그인을 마치지 못했습니다. 처음부터 다시 해주세요.',
    )
  })
})

describe('googleErrorMessage 영어 화면', () => {
  it('아는 코드도 모르는 값도 영어 문구로 보여 준다', async () => {
    useLocaleStore.getState().setLocale('en')
    await waitFor(() => expect(i18n.language).toBe('en'))

    expect(googleErrorMessage('AUTH_GOOGLE_LOGIN_CANCELLED')).toBe(
      'Google sign-in was cancelled.',
    )
    expect(googleErrorMessage('constructor')).toBe(
      "We couldn't finish signing you in with Google. Please start over.",
    )
  })
})
