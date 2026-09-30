/**
 * 향수를 찾는 문장에서 **이름 · 브랜드일 낱말**만 남깁니다.
 *
 *   "아쿠아디파르마 미르토 디 파나레아와 비슷한 향수" -> 아쿠아디파르마 · 미르토 · 디 · 파나레아
 *
 * 사람들은 이름 검색에도 "…와 비슷한 향수" 처럼 문장으로 칩니다 (지인 피드백 F2).
 * 그 말까지 이름에서 찾으면 아무것도 안 걸립니다. 낱말 끝의 조사도 뗍니다 — 낱말이
 * 두 글자보다 길 때만 떼어 '아리' 같은 이름이 잘리지 않게 합니다.
 *
 * 지도 이름 검색이 낱말을 고를 때와, 13만 개 전체 검색(A09)으로 넘길 때 씁니다.
 */
export function searchWords(keyword: string): string[] {
  return keyword
    .split(/\s+/)
    .map((word) =>
      word.length > 2 ? word.replace(TRAILING_PARTICLE, '') : word,
    )
    .filter((word) => word && !STOP_WORDS.has(word))
}

/** 이름이 아니라 찾는 말투인 낱말. 이름 · 브랜드에 들어갈 일이 드문 것만 둡니다 */
const STOP_WORDS = new Set([
  '향수',
  '향',
  '비슷한',
  '비슷한향수',
  '같은',
  '같은향수',
  '느낌',
  '추천',
  '추천해줘',
  '찾아줘',
  '알려줘',
])

const TRAILING_PARTICLE = /(이랑|하고|처럼|와|과|랑|의|을|를|은|는)$/
