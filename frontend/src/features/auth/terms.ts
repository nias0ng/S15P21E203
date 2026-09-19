/**
 * 약관 항목 정의 (와이어프레임 A32)
 *
 * 항목 구성은 법무 확인이 필요합니다. 컴포넌트와 분리해 둔 이유는
 * 검증 함수만 테스트하고 싶을 때 렌더링이 필요 없게 하려는 것입니다.
 */
export const TERMS = [
  { id: 'service', label: '이용약관', required: true },
  { id: 'privacy', label: '개인정보 처리방침', required: true },
  { id: 'marketing', label: '마케팅 정보 수신', required: false },
] as const

type TermId = (typeof TERMS)[number]['id']
export type TermsState = Record<TermId, boolean>

export const EMPTY_TERMS: TermsState = {
  service: false,
  privacy: false,
  marketing: false,
}

/** 필수 항목을 모두 동의했는지 — [가입하기] 활성 조건입니다. */
export function hasAgreedRequired(state: TermsState) {
  return TERMS.filter((term) => term.required).every((term) => state[term.id])
}
