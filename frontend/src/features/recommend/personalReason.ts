import { accordLabel } from './accordNames'

/**
 * 개인화 추천의 근거가 어디서 왔는가 — 서버의 세 신호입니다(`PersonalizedRecommendationService`).
 *
 *   FIT     진열대에서 적합도를 높게 매긴 향수와 향 특성이 닮음 (가중치 0.50)
 *   RECENT  최근 30일에 살펴본 향수들에서 자주 만난 향 특성 (0.15)
 *   TASTE   취향 테스트에서 고른 향 계열 (0.35)
 */
export type PersonalReasonSource = 'FIT' | 'RECENT' | 'TASTE'

export type PersonalReason = {
  /** 모르는 틀이면 null — 그때는 문장만 그대로 씁니다 */
  source: PersonalReasonSource | null
  /** 근거가 된 향 특성 · 향 계열(한국어). 모르는 틀이면 null */
  keyword: string | null
  /** 화면에 적을 문장. 영어 향 특성을 한국어로 바꿔 다시 지은 것입니다 */
  sentence: string
}

/**
 * 서버가 근거 문장을 짓는 틀 셋(`PersonalizedRecommendationService.reasonOf`). 틀 한가운데의 말이
 * 근거가 된 향 특성 · 향 계열입니다.
 *
 * NOTE: 문장을 읽어 갈래를 가리는 것은 임시입니다 — 응답에 `evidenceSource` · `evidenceName` 이 없어서
 * (서버 안에는 있습니다) 화면이 틀을 거꾸로 읽습니다. 백엔드가 두 칸을 내주면 이 표를 걷고 그 값을
 * 쓰세요. 틀이 바뀌면 여기서 못 읽고 문장만 그대로 나갑니다 — 화면이 깨지지는 않습니다.
 */
const TEMPLATES: {
  source: PersonalReasonSource
  pattern: RegExp
  write: (keyword: string) => string
  /** 향 특성은 영어로 와서(accords 표에 영어 이름뿐) 한국어로 바꿉니다. 향 계열은 이미 한국어입니다 */
  translate: boolean
}[] = [
  {
    source: 'FIT',
    pattern: /^높게 평가한 향수와 (.+?) 어코드가 비슷해요\.?$/,
    write: (keyword) => `높게 평가한 향수와 ${keyword} 어코드가 비슷해요.`,
    translate: true,
  },
  {
    source: 'RECENT',
    pattern: /^최근 살펴본 향수에서 자주 만난 (.+?) 어코드를 담고 있어요\.?$/,
    write: (keyword) =>
      `최근 살펴본 향수에서 자주 만난 ${keyword} 어코드를 담고 있어요.`,
    translate: true,
  },
  {
    source: 'TASTE',
    pattern: /^취향 테스트에서 선택한 (.+?) 계열과 잘 맞아요\.?$/,
    write: (keyword) => `취향 테스트에서 선택한 ${keyword} 계열과 잘 맞아요.`,
    translate: false,
  },
]

/**
 * 개인화 추천의 근거 문장을 읽어 갈래 · 근거 말 · 화면에 쓸 문장으로 나눕니다.
 *
 * 적합도 · 최근 본 향수 틀은 향 특성을 **영어 그대로** 넣어 옵니다(`woody 어코드`) — 서버의 accords 표에
 * 영어 이름뿐이라서입니다. 3D 향 지도 카드와 같은 표(accordNames)로 한국어로 바꿔 다시 짓습니다.
 *
 * @param reason 응답의 `recommendation.reason`
 * @returns 모르는 틀이면 갈래 · 근거 말 없이 문장만 그대로
 */
export function readPersonalReason(reason: string): PersonalReason {
  const text = reason.trim()
  for (const template of TEMPLATES) {
    const found = template.pattern.exec(text)
    const raw = found?.[1]?.trim()
    if (!raw) continue
    const keyword = template.translate ? accordLabel(raw) : raw
    return {
      source: template.source,
      keyword,
      sentence: template.write(keyword),
    }
  }
  return { source: null, keyword: null, sentence: text }
}
