import { describe, expect, it } from 'vitest'

import { splitSentences } from './splitSentences'

describe('splitSentences', () => {
  it('마침표 뒤의 공백에서 문장을 자른다', () => {
    expect(
      splitSentences(
        '처음에 오렌지 같은 상큼함이 느껴집니다. 겨울에는 향이 진하게 남는다고 합니다.',
      ),
    ).toEqual([
      '처음에 오렌지 같은 상큼함이 느껴집니다.',
      '겨울에는 향이 진하게 남는다고 합니다.',
    ])
  })

  it('물음표와 느낌표 뒤에서도 자른다', () => {
    expect(splitSentences('오래 갈까요? 오래 갑니다! 다만 옅습니다.')).toEqual([
      '오래 갈까요?',
      '오래 갑니다!',
      '다만 옅습니다.',
    ])
  })

  it('소수와 이름 속의 마침표에서는 자르지 않는다', () => {
    expect(
      splitSentences('No.5 는 4.5 시간쯤 남습니다. 잔향이 깁니다.'),
    ).toEqual(['No.5 는 4.5 시간쯤 남습니다.', '잔향이 깁니다.'])
  })

  it('줄바꿈도 문장의 끝으로 보고 빈 줄은 뺀다', () => {
    expect(splitSentences('  상큼합니다\n\n차분합니다.  ')).toEqual([
      '상큼합니다',
      '차분합니다.',
    ])
  })

  it('빈 글이면 빈 배열이다', () => {
    expect(splitSentences('   ')).toEqual([])
  })
})
