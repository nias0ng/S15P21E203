import { apiErrorMessage } from '@/shared/api/http'
import { i18n } from '@/shared/i18n'

import {
  ShelfRegisterPartialError,
  type ShelfPart,
} from './hooks/useShelfActions'

/**
 * 절반만 끝난 저장에서 빠진 칸들을 지금 화면 언어의 이름으로 잇습니다.
 * 한국어는 가운뎃점으로 늘어놓고("적합도 · 메모"), 영어는 문장 안에 들어가므로
 * 접속사로 잇습니다("match rating and memo").
 *
 * @param parts 오류가 들고 온 빠진 칸
 * @returns 토스트 문장에 끼울 이름 묶음
 */
export function shelfPartNames(parts: readonly ShelfPart[]): string {
  const names = parts.map((part) => i18n.t(`shelf:part.${part}`))
  if (i18n.language !== 'en') return names.join(' · ')
  return new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
    names,
  )
}

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
    return i18n.t('shelf:registerError.partial', {
      parts: shelfPartNames(error.missing),
    })
  }
  return apiErrorMessage(error, i18n.t('shelf:registerError.fallback'))
}
