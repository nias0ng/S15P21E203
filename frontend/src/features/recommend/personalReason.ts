import { scentFamilyName } from '@/shared/config/scentFamilies'
import { i18n } from '@/shared/i18n'

import { accordLabel } from './accordNames'
import type { PersonalRecommendation, PersonalReasonSource } from './types'

export type PersonalReason = {
  /** 근거의 갈래. 서버가 안 줬거나 모르는 값이면 null — 그때는 문장만 그대로 씁니다 */
  source: PersonalReasonSource | null
  /** 근거가 된 향 특성 · 향 계열(화면 언어). 문장을 서버 그대로 쓸 때는 null */
  keyword: string | null
  /** 화면에 적을 문장 */
  sentence: string
}

/** 갈래마다 화면 언어의 문장 틀. 부를 때 읽어야 언어를 바꾼 뒤에도 맞습니다 */
const WRITE: Record<PersonalReasonSource, (keyword: string) => string> = {
  FIT: (keyword) => i18n.t('recommend:personalReason.fit', { keyword }),
  RECENT: (keyword) => i18n.t('recommend:personalReason.recent', { keyword }),
  TASTE_TEST: (keyword) =>
    i18n.t('recommend:personalReason.taste', { keyword }),
}

/**
 * 근거 값을 화면 언어의 말로 바꿉니다. 적합도 · 최근 본 향수는 향 특성의 영어 이름(`woody`)이라
 * 3D 향 지도 카드와 같은 표(accordNames)로 옮기고, 취향 테스트는 향 계열 코드(`WOODY`)라 계열 이름표로
 * 옮깁니다. 모르는 계열 코드면 null — 코드를 문장에 박으면 `MOONLIGHT 계열` 같은 말이 나갑니다.
 */
function keywordOf(source: PersonalReasonSource, key: string): string | null {
  if (source === 'TASTE_TEST') return scentFamilyName(key.toUpperCase())
  return accordLabel(key)
}

function isSource(value: unknown): value is PersonalReasonSource {
  return value === 'FIT' || value === 'RECENT' || value === 'TASTE_TEST'
}

/**
 * 개인화 추천의 근거를 화면 언어의 문장으로 짓습니다 — 서버가 주는 갈래(`evidenceSource`)와 근거 값
 * (`evidenceKey`)으로 두 언어 모두 화면이 짓습니다. 서버 문장(`reason`)은 받을 때의 언어로 굳어 있어,
 * 그대로 쓰면 언어를 바꾼 뒤에도 앞 언어로 남습니다.
 *
 * 갈래를 모르거나 근거 값이 비었으면(서버가 모아 둔 옛 후보) 서버 문장을 그대로 씁니다. 갈래만 알면
 * 편지 머리말은 그 갈래로 섭니다.
 *
 * @param recommendation 개인화 추천 한 병
 * @returns 갈래 · 근거 말 · 화면에 쓸 문장
 */
export function readPersonalReason(
  recommendation: Pick<
    PersonalRecommendation,
    'reason' | 'evidenceSource' | 'evidenceKey'
  >,
): PersonalReason {
  const { reason, evidenceSource, evidenceKey } = recommendation
  const source = isSource(evidenceSource) ? evidenceSource : null
  const key = evidenceKey?.trim()
  const keyword = source && key ? keywordOf(source, key) : null
  if (source === null || keyword === null) {
    return { source, keyword: null, sentence: reason.trim() }
  }
  return { source, keyword, sentence: WRITE[source](keyword) }
}
