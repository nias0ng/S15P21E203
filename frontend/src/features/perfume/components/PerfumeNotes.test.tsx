import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PerfumeNotes } from './PerfumeNotes'

/**
 * 백엔드가 향조를 안 내려주는 동안 화면이 죽지 않는지 지킵니다(S15P21E203-169).
 * 응답에 notes 가 생기면 이 테스트는 그대로 두고 값이 있는 경우만 추가하세요.
 */
describe('PerfumeNotes', () => {
  it('향조가 없으면 죽지 않고 안내 문구를 보여준다', () => {
    render(<PerfumeNotes notes={undefined} />)

    expect(
      screen.getByText('향조 정보가 아직 등록되지 않았습니다.'),
    ).toBeInTheDocument()
  })

  it('세 구역이 모두 비어 있어도 안내 문구를 보여준다', () => {
    render(<PerfumeNotes notes={{ top: [], middle: [], base: [] }} />)

    expect(
      screen.getByText('향조 정보가 아직 등록되지 않았습니다.'),
    ).toBeInTheDocument()
  })

  it('향조가 있으면 구역별로 노트를 보여준다', () => {
    render(
      <PerfumeNotes
        notes={{
          top: ['베르가못'],
          middle: ['아이리스'],
          base: ['샌달우드', '머스크'],
        }}
      />,
    )

    expect(screen.getByText('탑 노트')).toBeInTheDocument()
    expect(screen.getByText('베르가못')).toBeInTheDocument()
    expect(screen.getByText('샌달우드')).toBeInTheDocument()
    expect(screen.getByText('머스크')).toBeInTheDocument()
  })

  it('한 구역만 비어 있으면 그 구역만 대시로 표시한다', () => {
    render(
      <PerfumeNotes
        notes={{ top: ['레몬'], middle: [], base: ['시더우드'] }}
      />,
    )

    expect(screen.getByText('레몬')).toBeInTheDocument()
    expect(screen.getByText('시더우드')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
