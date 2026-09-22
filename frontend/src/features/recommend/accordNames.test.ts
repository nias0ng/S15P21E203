import { describe, expect, it } from 'vitest'

import { accordLabel } from './accordNames'

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
