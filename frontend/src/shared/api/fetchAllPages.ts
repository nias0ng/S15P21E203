/** 백엔드 `MAX_PAGE_SIZE`. 더 큰 값을 보내도 서버가 여기로 깎습니다 */
export const MAX_PAGE_SIZE = 100

/** 페이지로 나뉜 목록 응답에서 남은 장수를 세는 데 쓰는 두 값 */
export interface PageInfo {
  size: number
  totalElements: number
}

/**
 * 페이지로 나뉜 목록을 끝까지 이어 받습니다. 기본 쪽 크기가 10이라 한 번만 부르면
 * 열한 번째부터 조용히 사라집니다. 대부분 첫 장에서 끝나 뒷장은 한 장씩 차례로 받습니다.
 *
 * @param fetchPage 0부터 세는 쪽 번호와 쪽 크기(`MAX_PAGE_SIZE`)로 한 장을 받아 옵니다
 * @param itemsOf 한 장의 응답에서 항목 배열을 꺼냅니다
 * @returns 모든 장의 항목을 받은 순서대로 이은 배열
 */
export async function fetchAllPages<Page extends PageInfo, Item>(
  fetchPage: (page: number, size: number) => Promise<Page>,
  itemsOf: (page: Page) => readonly Item[],
): Promise<Item[]> {
  const first = await fetchPage(0, MAX_PAGE_SIZE)
  const items = [...itemsOf(first)]

  // 서버가 size 를 깎을 수 있으므로 **응답이 알려준 size** 로 남은 장수를 셉니다
  const pageSize = first.size > 0 ? first.size : MAX_PAGE_SIZE
  const pages = Math.ceil(first.totalElements / pageSize)

  for (let page = 1; page < pages; page += 1) {
    const next = await fetchPage(page, MAX_PAGE_SIZE)
    items.push(...itemsOf(next))
  }

  return items
}
