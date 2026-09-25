import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import themeSource from '../../styles/index.css?raw'

import { ChipToggle } from './ChipToggle'

const SEASONS = [
  { value: 'SPRING', label: '봄' },
  { value: 'SUMMER', label: '여름' },
] as const

function Harness() {
  const [picked, setPicked] = useState<string[]>([])
  return (
    <ChipToggle
      label="계절"
      options={SEASONS}
      multiple
      value={picked}
      onChange={setPicked}
    />
  )
}

const declared = (prefix: string) =>
  new Set(
    [
      ...themeSource.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+)\\s*:`, 'g')),
    ].map((match) => match[1] ?? ''),
  )

const COLORS = declared('color')
const FONT_SIZES = declared('text')
const BUILT_IN = new Set([
  'transparent',
  'current',
  'inherit',
  'white',
  'black',
])

const COLOR_UTILITY =
  /^(bg|text|border|ring|fill|stroke)-(?!\[)([a-z][a-z0-9-]*)$/

const danglingTokens = (className: string) =>
  className.split(/\s+/).flatMap((entry) => {
    const bare = (entry.split(':').at(-1) ?? '').split('/')[0] ?? ''

    const match = COLOR_UTILITY.exec(bare)
    if (match === null) return []

    const prefix = match[1] ?? ''
    const name = match[2] ?? ''
    if (BUILT_IN.has(name) || COLORS.has(name)) return []
    if (prefix === 'text' && FONT_SIZES.has(name)) return []

    return [bare]
  })

describe('ChipToggle', () => {
  it('고르면 눌린 상태가 되고 다시 누르면 풀린다', async () => {
    render(<Harness />)

    const spring = screen.getByRole('button', { name: '봄' })

    await userEvent.click(spring)
    expect(spring).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(spring)
    expect(spring).toHaveAttribute('aria-pressed', 'false')
  })

  it('고른 칩과 안 고른 칩의 색이 전부 @theme 에 있는 토큰을 가리킨다', async () => {
    render(<Harness />)

    const spring = screen.getByRole('button', { name: '봄' })
    const summer = screen.getByRole('button', { name: '여름' })

    await userEvent.click(spring)

    expect({
      고른칩: danglingTokens(spring.className),
      안고른칩: danglingTokens(summer.className),
    }).toEqual({ 고른칩: [], 안고른칩: [] })
  })
})
