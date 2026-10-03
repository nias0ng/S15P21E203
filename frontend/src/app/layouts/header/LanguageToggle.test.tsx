import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { apiErrorMessage, ApiError } from '@/shared/api/http'
import { useLocaleStore } from '@/shared/store/localeStore'

import { LanguageToggle } from './LanguageToggle'
import { inkOf } from './tone'

afterEach(() => {
  localStorage.clear()
})

const renderToggle = () => render(<LanguageToggle ink={inkOf('surface')} />)

describe('LanguageToggle', () => {
  it('누른 언어로 화면 언어 · 문서 언어 · 탭 제목이 바뀌고 남는다', async () => {
    renderToggle()

    expect(screen.getByRole('button', { name: '한국어' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(useLocaleStore.getState().locale).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Hyanghae · Perfume Recommendations')
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
    expect(localStorage.getItem('hyanghae-locale')).toContain('"en"')
  })
})

describe('apiErrorMessage', () => {
  const taken = new ApiError(
    409,
    'AUTH_EMAIL_ALREADY_EXISTS',
    '이미 사용 중인 이메일입니다.',
  )

  it('한국어 화면은 서버 문구를 그대로 쓴다', () => {
    expect(apiErrorMessage(taken, '대체 문구')).toBe(
      '이미 사용 중인 이메일입니다.',
    )
  })

  it('영어 화면은 코드에 맞는 영어 문구를, 모르는 코드면 대체 문구를 쓴다', async () => {
    renderToggle()
    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(apiErrorMessage(taken, 'fallback')).toBe(
      'This email is already in use.',
    )
    expect(
      apiErrorMessage(
        new ApiError(400, 'SOMETHING_NEW', '새 오류'),
        'fallback',
      ),
    ).toBe('fallback')
  })
})
