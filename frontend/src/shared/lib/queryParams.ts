/**
 * 주소의 쿼리를 다루는 규칙.
 *
 * 목록 화면마다 `new URLSearchParams(searchParams)` 를 만들어 손으로 set · delete
 * 하고 있었고, 쪽 번호를 읽는 줄은 **네 파일에 글자 하나 안 틀리고 똑같이** 있었습니다.
 * 같은 규칙이 흩어져 있으면 한 곳만 고쳐도 티가 안 납니다 — 실제로 쪽 번호를 쓰는
 * 규칙이 화면마다 조금씩 달라져 있었습니다(아래 `writePage` 주석).
 */

/** 쪽 번호가 담기는 쿼리 이름 */
export const PAGE_PARAM = 'page'

/**
 * 쿼리 일부만 바꾼 새 `URLSearchParams` 를 만듭니다.
 *
 * 값이 있으면 넣고, `null` 이면 뺍니다 — 목록 화면의 "필터를 골랐다 / 껐다" 가
 * 그대로 이 두 가지입니다. 원본은 건드리지 않습니다.
 */
export function withQueryParams(
  current: URLSearchParams,
  updates: Record<string, string | null>,
): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
  }
  return next
}

/**
 * 주소의 쪽 번호를 읽습니다. **주소는 1부터, 안에서는 0부터** 셉니다 —
 * 주소창에 `page=0` 이 보이면 사람이 읽기 어렵고, 목록 API 는 0부터라서입니다.
 *
 * 없으면 첫 쪽(0)입니다. **숫자가 아니거나 범위를 벗어난 값도 첫 쪽으로 봅니다** —
 * 흩어져 있던 원래 식(`Math.max(0, Number(...) - 1)`)은 `?page=abc` 에서 `NaN` 을
 * 내놓았고, 그 값이 그대로 쿼리 키에 들어가 화면이 빈 채로 멈췄습니다.
 */
export function readPage(params: URLSearchParams): number {
  const raw = Number(params.get(PAGE_PARAM))
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw) - 1)
}

/**
 * 쪽 번호를 주소에 적습니다(0부터 세는 값을 받습니다).
 *
 * **첫 쪽은 적지 않습니다.** `?page=1` 이 붙은 주소와 안 붙은 주소가 갈리면 같은
 * 화면이 주소 두 개를 갖게 되고, 뒤로가기가 아무 일도 안 하는 것처럼 보입니다.
 * 이 규칙이 화면마다 달랐습니다 — 검색 결과만 첫 쪽에도 `page=1` 을 붙이고
 * 있었습니다.
 */
export function writePage(
  current: URLSearchParams,
  page: number,
): URLSearchParams {
  const next = new URLSearchParams(current)
  if (page <= 0) next.delete(PAGE_PARAM)
  else next.set(PAGE_PARAM, String(page + 1))
  return next
}
