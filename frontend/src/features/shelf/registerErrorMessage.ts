import { apiErrorMessage } from '@/shared/api/http'

import { ShelfRegisterPartialError } from './hooks/useShelfActions'

/**
 * 진열대에 담기가 실패했을 때 토스트에 적을 문장. 토스트를 띄우는 일은 화면이 합니다.
 *
 * 절반만 끝난 등록은 담긴 것이 사실이라 "담았지만 무엇은 못 했다" 로 적습니다 — 실패로만
 * 적으면 다시 담으려다 409 를 만납니다.
 *
 * @param error `useShelfActions().register` 가 넘긴 오류
 * @returns 토스트에 적을 한 문장
 */
export function shelfRegisterErrorMessage(error: unknown): string {
  if (error instanceof ShelfRegisterPartialError) {
    return `진열대에 담았지만 ${error.missing.join(' · ')}은(는) 저장하지 못했습니다`
  }
  return apiErrorMessage(error, '진열대에 저장하지 못했습니다.')
}
