import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

/*
  ⚠ `node:fs` 가 아니라 Vite 의 `?raw` 로 읽습니다 — 이 앱의 tsconfig 는 브라우저
  앱이라 node 타입이 없습니다(`diveTrack.test.ts` 가 같은 이유로 이렇게 합니다).
  CSS 는 내보내는 것이 없어 원문밖에 길이 없습니다.
*/
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

/** `@theme` 에 `--<prefix>-<이름>` 으로 선언된 토큰 이름들 */
const declared = (prefix: string) =>
  new Set(
    [
      ...themeSource.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+)\\s*:`, 'g')),
    ].map((match) => match[1] ?? ''),
  )

const COLORS = declared('color')
const FONT_SIZES = declared('text')
/** Tailwind 가 토큰 없이 늘 내주는 값들 */
const BUILT_IN = new Set([
  'transparent',
  'current',
  'inherit',
  'white',
  'black',
])

const COLOR_UTILITY =
  /^(bg|text|border|ring|fill|stroke)-(?!\[)([a-z][a-z0-9-]*)$/

/** 이 클래스들이 가리키는 토큰 가운데 `@theme` 에 없는 것 */
const danglingTokens = (className: string) =>
  className.split(/\s+/).flatMap((entry) => {
    // `hover:` · `focus-visible:` 같은 앞머리와 `/85` 같은 투명도를 떼고 봅니다
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

  /*
    Tailwind v4 는 `@theme` 에 없는 토큰을 **조용히 버립니다** — 클래스 이름은
    남는데 규칙이 아예 안 만들어져 색만 사라집니다. 눈으로는 "고른 표시가 안
    보인다" 로 보이고 빌드도 린트도 통과합니다. 그래서 여기서 막습니다.

    고른 칩이 `bg-accent-warm` 을 달고 있었는데 그 토큰이 없어, 유리판 위에서
    바탕 · 테두리 · 글자가 전부 사라졌던 적이 있습니다 (S15P21E203-370).
  */
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
