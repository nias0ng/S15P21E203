import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { FeedbackButton } from './FeedbackButton'

describe('FeedbackButton', () => {
  it('피드백 폼을 새 탭으로 여는 링크다', () => {
    render(
      <MemoryRouter>
        <FeedbackButton />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: '피드백 보내기 (새 탭)' })
    expect(link).toHaveAttribute('href', 'https://forms.gle/mDvTFiY3H9Xew42K7')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
