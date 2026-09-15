import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PerfumeNote } from '../types'

import { PerfumeNotes } from './PerfumeNotes'

const note = (
  noteId: number,
  name: string,
  noteType: string | null,
): PerfumeNote => ({ noteId, name, noteType })

/**
 * `noteType` 은 컬럼에 값 제약이 없어 백엔드가 문자열 그대로 내려줍니다. 묶는 일이
 * 화면 몫이라, 모르는 값이 와도 노트가 사라지지 않는지를 여기서 지킵니다.
 */
describe('PerfumeNotes', () => {
  it('향조가 없으면 안내 문구를 보여준다', () => {
    render(<PerfumeNotes notes={[]} />)

    expect(
      screen.getByText('향조 정보가 아직 등록되지 않았습니다.'),
    ).toBeInTheDocument()
  })

  it('탑 · 미들 · 베이스 순으로 묶어 보여준다', () => {
    render(
      <PerfumeNotes
        notes={[
          note(1, '샌달우드', 'BASE'),
          note(2, '베르가못', 'TOP'),
          note(3, '아이리스', 'MIDDLE'),
        ]}
      />,
    )

    const labels = screen
      .getAllByText(/노트$/)
      .map((element) => element.textContent)

    expect(labels).toEqual(['탑 노트', '미들 노트', '베이스 노트'])
  })

  it('없는 구역은 줄을 만들지 않는다', () => {
    render(<PerfumeNotes notes={[note(1, '레몬', 'TOP')]} />)

    expect(screen.getByText('탑 노트')).toBeInTheDocument()
    expect(screen.queryByText('미들 노트')).not.toBeInTheDocument()
  })

  it('모르는 구역이 와도 버리지 않고 제 이름으로 보여준다', () => {
    render(<PerfumeNotes notes={[note(1, '머스크', 'DRYDOWN')]} />)

    expect(screen.getByText('DRYDOWN')).toBeInTheDocument()
    expect(screen.getByText('머스크')).toBeInTheDocument()
  })

  it('구역이 비어 있는 노트는 기타로 묶는다', () => {
    render(<PerfumeNotes notes={[note(1, '앰버', null)]} />)

    expect(screen.getByText('기타')).toBeInTheDocument()
    expect(screen.getByText('앰버')).toBeInTheDocument()
  })
})
