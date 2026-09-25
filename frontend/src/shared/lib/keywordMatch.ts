/**
 * 검색어 하나로 목록을 거르는 검사기를 만듭니다. 대소문자는 가리지 않고, 앞뒤 공백은
 * 떼고 봅니다.
 *
 * 검사기를 돌려주는 까닭: 목록을 거를 때 항목마다 검색어를 다시 다듬지 않게 한 번만
 * 다듬어 둡니다.
 *
 * @param keyword 사용자가 친 검색어
 * @returns 항목의 칸들을 받아 하나라도 검색어를 품으면 true 를 돌려주는 함수. 검색어가
 *   비었으면 모든 항목이 걸립니다. 빈 칸(`null` · `undefined`)은 걸리지 않는 칸으로 봅니다
 */
export function keywordMatcher(
  keyword: string,
): (...fields: (string | null | undefined)[]) => boolean {
  const needle = keyword.trim().toLowerCase()
  return (...fields) =>
    !needle ||
    fields.some((field) => field?.toLowerCase().includes(needle) ?? false)
}
