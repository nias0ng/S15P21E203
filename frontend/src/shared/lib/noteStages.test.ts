import { describe, expect, it } from 'vitest'

import { groupNoteStages } from './noteStages'

const note = (noteId: number, name: string, noteType: string | null) => ({
  noteId,
  name,
  noteType,
})

/** 줄마다 단계와 노트 이름만 뽑아 봅니다 */
const rowsOf = (notes: ReturnType<typeof note>[]) =>
  groupNoteStages(notes).map(({ stage, notes: inStage }) => [
    stage,
    inStage.map(({ name }) => name),
  ])

describe('groupNoteStages', () => {
  it('소문자 단계도 받은 순서와 상관없이 탑 · 미들 · 베이스 순으로 묶는다', () => {
    // 운 자르뎅 쉬르 르 닐 실측 — base 가 먼저 옵니다
    expect(
      rowsOf([
        note(26, 'Cinnamon', 'base'),
        note(19, 'Grapefruit', 'top'),
        note(102, 'Lotus', 'middle'),
        note(1, 'Musk', 'base'),
      ]),
    ).toEqual([
      ['TOP', ['Grapefruit']],
      ['MIDDLE', ['Lotus']],
      ['BASE', ['Cinnamon', 'Musk']],
    ])
  })

  it('없는 단계는 줄을 만들지 않는다', () => {
    expect(rowsOf([note(1, 'Musk', 'BASE')])).toEqual([['BASE', ['Musk']]])
  })

  it('두 단계에 걸친 노트는 양쪽에 넣는다', () => {
    expect(rowsOf([note(1, 'Bergamot', 'top + middle+base')])).toEqual([
      ['TOP', ['Bergamot']],
      ['MIDDLE', ['Bergamot']],
      ['BASE', ['Bergamot']],
    ])
  })

  it('피라미드가 없는 향수는 세 단계 뒤에, 모르는 단계는 그 뒤에 처음 나온 순서로 둔다', () => {
    expect(
      rowsOf([
        note(1, 'Smoke', 'heart'),
        note(2, 'Amber', 'flat'),
        note(3, 'Rose', 'middle'),
        note(4, 'Iris', 'Accord'),
      ]),
    ).toEqual([
      ['MIDDLE', ['Rose']],
      ['FLAT', ['Amber']],
      ['HEART', ['Smoke']],
      ['ACCORD', ['Iris']],
    ])
  })

  it.each([null, '', '  ', '+'])('단계가 %j 이면 기타로 묶는다', (noteType) => {
    expect(rowsOf([note(1, 'Salt', noteType)])).toEqual([['기타', ['Salt']]])
  })

  it('기타는 모르는 단계와 함께 처음 나온 순서로 선다', () => {
    expect(
      rowsOf([
        note(1, 'Salt', null),
        note(2, 'Smoke', 'heart'),
        note(3, 'Rose', 'top'),
      ]),
    ).toEqual([
      ['TOP', ['Rose']],
      ['기타', ['Salt']],
      ['HEART', ['Smoke']],
    ])
  })

  it('노트는 받은 모양 그대로 돌려준다', () => {
    const salt = note(4, 'Salt', 'top')

    expect(groupNoteStages([salt])[0]?.notes[0]).toBe(salt)
  })

  it('노트가 없으면 줄도 없다', () => {
    expect(groupNoteStages([])).toEqual([])
  })
})
