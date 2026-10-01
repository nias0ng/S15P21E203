import type { RecommendResult } from './types'

/**
 * **열려 있던 추천 결과 한 벌** — 상세로 나갔다 돌아올 때 같은 결과를 다시 펼치려고 듭니다
 * (2026-10-01 · 메인 사용성 테스트).
 *
 * 결과에서 [자세히 보기]를 누르면 `HomePage` 가 통째로 언마운트되고, 추천 캐시는 결과창이
 * 닫히면 버리는 규칙이라(`recommendationQuery` 의 `gcTime: 0`) 같이 사라집니다. 그래서 상세의
 * '← 추천 결과' 를 눌러도 결과 대신 설문만 떴고, 다섯 개를 비교하려면 같은 말로 다시 찾아야
 * 했습니다(7명 중 6명이 같은 데서 막혔습니다).
 *
 * ⚠️ **사람이 결과창을 닫으면 버립니다**(`RecommendModal` 의 닫기). 같은 말로 **다시 찾는 것**은
 *   새 추천이라 서버가 새 기록 · 새 설문 손잡이를 내야 합니다 — 담아 둔 답을 꺼내면 이미 닫은
 *   손잡이가 와서 설문이 안 걸립니다(`recommendationQuery` 머리말). 꺼내 쓰는 것은 **주소에 그 말이
 *   남은 채 돌아온 경우**(`/?q=`) 하나뿐입니다 — 그건 새로 찾은 것이 아니라 보던 화면으로 돌아온 것입니다.
 * ⚠️ `sessionStorage` 입니다. 탭을 닫으면 같이 사라지고, 다른 탭으로 연 같은 주소는 새로 받습니다.
 */
const KEY = 'hyanghae-nlr-open'

export type OpenRecommendation = { query: string; result: RecommendResult }

export function keepOpenRecommendation(value: OpenRecommendation) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // 저장소를 못 쓰는 창(사생활 보호 등)이면 돌아올 때 새로 받습니다 — 예전과 같습니다
  }
}

/** 그 말로 열려 있던 결과. 다른 말이거나 없으면 `undefined` 입니다 */
export function readOpenRecommendation(
  query: string,
): OpenRecommendation | undefined {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw === null) return undefined
    const value = JSON.parse(raw) as Partial<OpenRecommendation> | null
    // 모양이 다르면(예전 판 · 손상) 버립니다 — 결과창이 빈 배열을 읽다 떨어지지 않게
    if (value?.query !== query || !Array.isArray(value.result?.perfumes)) {
      return undefined
    }
    return { query, result: value.result }
  } catch {
    return undefined
  }
}

export function dropOpenRecommendation() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // 위와 같습니다
  }
}
