import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import type { ScentFamilyKey } from '../types'

import { FamilyPicker } from './FamilyPicker'

function Harness() {
  const [picks, setPicks] = useState<ScentFamilyKey[]>([])
  return <FamilyPicker value={picks} onChange={setPicks} />
}

describe('FamilyPicker', () => {
  it('두 개를 고르면 나머지 타일을 누를 수 없다', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: /플로럴/ }))
    await userEvent.click(screen.getByRole('button', { name: /머스크/ }))

    expect(screen.getByRole('button', { name: /플로럴/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /머스크/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /우디/ })).toBeDisabled()
  })

  it('고른 것을 해제하면 나머지가 다시 살아난다', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: /플로럴/ }))
    await userEvent.click(screen.getByRole('button', { name: /머스크/ }))
    await userEvent.click(screen.getByRole('button', { name: /머스크/ }))

    expect(screen.getByRole('button', { name: /우디/ })).toBeEnabled()
  })

  it('고른 순서대로 1순위 · 2순위를 표시한다', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: /머스크/ }))
    await userEvent.click(screen.getByRole('button', { name: /플로럴/ }))

    expect(screen.getByRole('button', { name: /머스크/ })).toHaveTextContent(
      '1순위',
    )
    expect(screen.getByRole('button', { name: /플로럴/ })).toHaveTextContent(
      '2순위',
    )
  })

  it('고른 타일은 aria-pressed 로 표시된다', async () => {
    render(<Harness />)

    const floral = screen.getByRole('button', { name: /플로럴/ })
    expect(floral).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(floral)
    expect(screen.getByRole('button', { name: /플로럴/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('영어 화면은 영어 형용사 · 이름과 순위를 쓴다', async () => {
    useLocaleStore.getState().setLocale('en')
    render(<Harness />)

    expect(
      screen.getByRole('group', { name: 'Pick scent families' }),
    ).toBeInTheDocument()
    const floral = screen.getByRole('button', { name: 'Radiant · Floral' })
    await userEvent.click(floral)

    expect(floral).toHaveTextContent('Floral')
    expect(floral).toHaveTextContent('#1')
  })
})
