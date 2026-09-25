import { describe, expect, it } from 'vitest'

import { ApiError } from '@/shared/api/http'

import { ShelfRegisterPartialError } from './hooks/useShelfActions'
import { shelfRegisterErrorMessage } from './registerErrorMessage'

describe('shelfRegisterErrorMessage', () => {
  it('절반만 끝났으면 담긴 것과 못 한 것을 함께 적는다', () => {
    expect(
      shelfRegisterErrorMessage(
        new ShelfRegisterPartialError(['적합도', '메모']),
      ),
    ).toBe('진열대에 담았지만 적합도 · 메모은(는) 저장하지 못했습니다')
  })

  it('서버가 답한 오류면 서버 문구를 쓴다', () => {
    expect(
      shelfRegisterErrorMessage(
        new ApiError(
          409,
          'SHELF_ITEM_DUPLICATED',
          '이미 진열대에 있는 향수입니다',
        ),
      ),
    ).toBe('이미 진열대에 있는 향수입니다')
  })

  it('그 밖의 예외면 저장하지 못했다고 적는다', () => {
    expect(shelfRegisterErrorMessage(new TypeError('엉뚱한 오류'))).toBe(
      '진열대에 저장하지 못했습니다.',
    )
  })
})
