import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PerfumeNote } from '../types'

import { PerfumeNotes } from './PerfumeNotes'

const note = (
  noteId: number,
  name: string,
  noteType: string | null,
): PerfumeNote => ({ noteId, name, noteType })

/** 화면에 난 단계 라벨을 나온 순서대로 읽습니다 */
const stages = () =>
  screen.queryAllByText(/^(Top|Middle|Base)$/).map((el) => el.textContent)

/**
 * `noteType` 은 컬럼에 값 제약이 없어 문자열 그대로 내려옵니다(시드는 `top` ·
 * `middle` · `base` · `flat` 과 조합). 쪼개고 묶는 일이 화면 몫이라, 모르는 값이
 * 와도 노트가 사라지지 않는지를 여기서 지킵니다.
 */
describe('PerfumeNotes', () => {
  it('향조가 없으면 안내 문구를 보여준다', () => {
    render(<PerfumeNotes notes={[]} />)

    expect(
      screen.getByText('향조 정보가 아직 등록되지 않았습니다.'),
    ).toBeInTheDocument()
  })

  it('Top · Middle · Base 순으로 묶어 보여준다', () => {
    render(
      <PerfumeNotes
        notes={[
          note(1, '샌달우드', 'base'),
          note(2, '베르가못', 'top'),
          note(3, '아이리스', 'middle'),
        ]}
      />,
    )

    expect(stages()).toEqual(['Top', 'Middle', 'Base'])
  })

  it('없는 단계는 줄을 만들지 않는다', () => {
    render(
      <PerfumeNotes
        notes={[note(1, '레몬', 'top'), note(2, '앰버', 'base')]}
      />,
    )

    expect(stages()).toEqual(['Top', 'Base'])
  })

  it('조합 값은 쪼개서 양쪽 줄에 같은 노트를 넣는다', () => {
    render(<PerfumeNotes notes={[note(1, '로즈', 'top+middle')]} />)

    expect(stages()).toEqual(['Top', 'Middle'])
    expect(screen.getAllByText('로즈')).toHaveLength(2)
  })

  it('top+middle+base 는 세 줄 모두에 들어간다', () => {
    render(<PerfumeNotes notes={[note(1, '머스크', 'top+middle+base')]} />)

    expect(stages()).toEqual(['Top', 'Middle', 'Base'])
    expect(screen.getAllByText('머스크')).toHaveLength(3)
  })

  /** 향수의 27% 입니다 — 원본에 피라미드가 없어 단계를 지어낼 수 없습니다 */
  it('flat 은 라벨 없이 한 줄로 보여준다', () => {
    render(
      <PerfumeNotes
        notes={[note(1, '앰버', 'flat'), note(2, '오크모스', 'flat')]}
      />,
    )

    expect(stages()).toEqual([])
    expect(screen.queryByText('flat')).not.toBeInTheDocument()
    expect(screen.queryByText('FLAT')).not.toBeInTheDocument()
    expect(screen.getByText('앰버')).toBeInTheDocument()
    expect(screen.getByText('오크모스')).toBeInTheDocument()
  })

  it('모르는 단계가 와도 버리지 않고 제 이름으로 보여준다', () => {
    render(<PerfumeNotes notes={[note(1, '머스크', 'drydown')]} />)

    expect(screen.getByText('DRYDOWN')).toBeInTheDocument()
    expect(screen.getByText('머스크')).toBeInTheDocument()
  })

  it('모르는 단계는 아는 단계 뒤에 붙는다', () => {
    const { container } = render(
      <PerfumeNotes
        notes={[note(1, '머스크', 'drydown'), note(2, '레몬', 'top')]}
      />,
    )

    expect(container.textContent).toMatch(/Top.*레몬.*DRYDOWN.*머스크/s)
  })

  it('단계가 비어 있는 노트는 기타로 묶는다', () => {
    render(<PerfumeNotes notes={[note(1, '앰버', null)]} />)

    expect(screen.getByText('기타')).toBeInTheDocument()
    expect(screen.getByText('앰버')).toBeInTheDocument()
  })
})
