import { describe, expect, it } from 'vitest'

import accordCsv from '../../../landing/data/accord_names_ko.csv?raw'

import { accordLabel, ACCORD_NAMES_KO } from './accordNames'

describe('accordLabel', () => {
  it('향 특성을 한국어로 바꾼다', () => {
    expect(accordLabel('citrus')).toBe('시트러스')
    expect(accordLabel('woody')).toBe('우디')
  })

  // 근거 칸은 여럿이면 ' · ' 로 이어져 옵니다 (응답 DTO 계약)
  it('여럿이면 구분자를 지키고 낱개로 바꾼다', () => {
    expect(accordLabel('soapy · fresh')).toBe('비누 · 프레시')
  })

  /*
    향 특성이 아닌 근거도 같은 칸으로 옵니다. 모르는 값을 지우거나 비우면 그 줄이 통째로
    사라져, 왜 이 향수가 나왔는지 답하는 자리가 없어집니다.
  */
  it('모르는 값은 그대로 둔다', () => {
    expect(accordLabel('가을 어울림 평가 71%')).toBe('가을 어울림 평가 71%')
    expect(accordLabel('bbq')).toBe('bbq')
  })

  // 백엔드가 AccordLabeler 를 채워 한국어를 보내기 시작해도 두 번 바꾸지 않아야 합니다
  it('이미 한국어면 건드리지 않는다', () => {
    expect(accordLabel('시트러스')).toBe('시트러스')
  })
})

/*
  표는 3D 향 지도가 향수 카드에 쓰는 `landing/data/accord_names_ko.csv` 를 손으로 옮긴 것입니다.
  한쪽만 고치면 같은 향 특성이 카드와 추천 이유에서 다른 말이 됩니다. 번들에 CSV 읽기를 싣지
  않으려고 표는 그대로 두고, 둘이 같은지를 여기서 봅니다.
*/
describe('ACCORD_NAMES_KO', () => {
  it('3D 향 지도의 어코드 한글 표(CSV)와 같은 쌍을 갖는다', () => {
    const [header = [], ...rows] = parseCsv(accordCsv)
    const accordAt = header.indexOf('accord')
    const nameAt = header.indexOf('name_ko')
    expect(accordAt).toBeGreaterThanOrEqual(0)
    expect(nameAt).toBeGreaterThanOrEqual(0)

    const pairs = rows.map((cells) => [cells[accordAt], cells[nameAt]])
    // 같은 어코드가 두 줄이면 뒤 줄이 앞 줄을 조용히 덮으니 먼저 막습니다
    expect(new Set(pairs.map(([accord]) => accord)).size).toBe(pairs.length)
    expect(ACCORD_NAMES_KO).toEqual(Object.fromEntries(pairs))
  })

  it('CSV 읽기는 따옴표 안의 쉼표 · 겹따옴표 · CRLF 를 한 칸으로 읽는다', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
  })
})

/**
 * 따옴표로 감싼 칸을 읽는 작은 CSV 읽기. 칸 안의 쉼표 · 줄바꿈과 겹따옴표(`""`)를 풉니다 —
 * 표의 note 칸이 사람이 쓴 문장이라 쉼표로만 자르면 칸이 밀립니다.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < source.length; i++) {
    const ch = source.charAt(i)
    if (quoted) {
      if (ch !== '"') field += ch
      else if (source.charAt(i + 1) === '"') {
        field += '"'
        i++
      } else quoted = false
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source.charAt(i + 1) === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ''))
}
