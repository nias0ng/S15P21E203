/** 쪽 번호가 담기는 쿼리 이름 */
const PAGE_PARAM = 'page'

/**
 * 쿼리 일부만 바꾼 새 `URLSearchParams` 를 만듭니다. 원본은 건드리지 않습니다.
 *
 * @param current 지금 주소의 쿼리
 * @param updates 바꿀 항목. 값이 있으면 넣고 `null` · 빈 문자열이면 뺍니다 —
 *   목록 화면의 "필터를 골랐다 / 껐다" 가 그대로 이 두 가지입니다
 * @returns 새 `URLSearchParams`
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
 * 주소(`?sort=` · `?gender=`)에서 읽은 값이 고를 수 있는 값 가운데 하나인지 거릅니다.
 * 주소는 사람이 고쳐 쓸 수 있어 **모르는 값은 "안 고름"(`null`)** 으로 봅니다 — 그대로
 * API 에 실으면 400 이라 화면이 통째로 빕니다.
 *
 * @param value `searchParams.get` 이 준 값
 * @param options 화면이 늘어놓는 선택지(`{ value, label }[]` 그대로 넘겨도 됩니다)
 * @returns 선택지에 있는 값. 없거나 모르는 값이면 null
 */
export function readOption<T extends string>(
  value: string | null,
  options: readonly { value: T }[],
): T | null {
  return options.some((option) => option.value === value) ? (value as T) : null
}

/**
 * 주소의 쪽 번호를 읽습니다. **주소는 1부터, 안에서는 0부터** 셉니다 — 주소창에
 * `page=0` 이 보이면 사람이 읽기 어렵고, 목록 API 는 0부터라서입니다.
 *
 * @param params 화면의 `useSearchParams` 값
 * @returns 0부터 세는 쪽 번호. 없거나 숫자가 아니거나(`?page=abc`) 범위를 벗어나면 0
 */
export function readPage(params: URLSearchParams): number {
  const raw = Number(params.get(PAGE_PARAM))
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw) - 1)
}

/**
 * 쪽 번호를 주소에 적습니다.
 *
 * **첫 쪽은 적지 않습니다.** `?page=1` 이 붙은 주소와 안 붙은 주소가 갈리면 같은
 * 화면이 주소 두 개를 갖게 되고, 뒤로가기가 아무 일도 안 하는 것처럼 보입니다.
 *
 * @param current 지금 주소의 쿼리
 * @param page 0부터 세는 쪽 번호
 * @returns 새 `URLSearchParams`
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
