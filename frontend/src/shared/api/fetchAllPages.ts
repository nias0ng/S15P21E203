export const MAX_PAGE_SIZE = 100

export interface PageInfo {
  size: number
  totalElements: number
}

export async function fetchAllPages<Page extends PageInfo, Item>(
  fetchPage: (page: number, size: number) => Promise<Page>,
  itemsOf: (page: Page) => readonly Item[],
): Promise<Item[]> {
  const first = await fetchPage(0, MAX_PAGE_SIZE)
  const items = [...itemsOf(first)]

  const pageSize = first.size > 0 ? first.size : MAX_PAGE_SIZE
  const pages = Math.ceil(first.totalElements / pageSize)

  for (let page = 1; page < pages; page += 1) {
    const next = await fetchPage(page, MAX_PAGE_SIZE)
    items.push(...itemsOf(next))
  }

  return items
}
