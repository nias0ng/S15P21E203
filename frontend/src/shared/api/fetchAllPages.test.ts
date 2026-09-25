import { describe, expect, it, vi } from 'vitest'

import { fetchAllPages, MAX_PAGE_SIZE } from './fetchAllPages'

type Page = { rows: number[]; size: number; totalElements: number }

/** `total` 개를 `served` 개씩 나눠 주는 가짜 서버 */
function serverOf(total: number, served: number) {
  return vi.fn(async (page: number): Promise<Page> => {
    const start = page * served
    const end = Math.min(start + served, total)
    return {
      rows: Array.from(
        { length: Math.max(0, end - start) },
        (_, i) => start + i,
      ),
      size: served,
      totalElements: total,
    }
  })
}

const rowsOf = (page: Page) => page.rows

describe('fetchAllPages', () => {
  it('한 장에 다 들어오면 한 번만 부른다', async () => {
    const fetchPage = serverOf(30, MAX_PAGE_SIZE)

    const items = await fetchAllPages(fetchPage, rowsOf)

    expect(items).toHaveLength(30)
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith(0, MAX_PAGE_SIZE)
  })

  it('남은 장을 차례로 이어 받아 순서대로 잇는다', async () => {
    const fetchPage = serverOf(250, MAX_PAGE_SIZE)

    const items = await fetchAllPages(fetchPage, rowsOf)

    expect(items).toEqual(Array.from({ length: 250 }, (_, i) => i))
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([0, 1, 2])
  })

  /*
    서버가 쪽 크기를 깎아 주면 우리가 보낸 100 이 아니라 응답의 size 로 장수를 셉니다.
    보낸 값으로 세면 뒷장을 덜 받아 뒤쪽 항목이 조용히 사라집니다.
  */
  it('서버가 깎은 쪽 크기로 남은 장수를 센다', async () => {
    const fetchPage = serverOf(25, 10)

    const items = await fetchAllPages(fetchPage, rowsOf)

    expect(items).toHaveLength(25)
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it('비어 있으면 첫 장만 부른다', async () => {
    const fetchPage = serverOf(0, MAX_PAGE_SIZE)

    expect(await fetchAllPages(fetchPage, rowsOf)).toEqual([])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('응답의 size 가 0 이면 보낸 쪽 크기로 센다', async () => {
    const fetchPage = vi.fn(async (page: number): Promise<Page> => ({
      rows: [page],
      size: 0,
      totalElements: 150,
    }))

    expect(await fetchAllPages(fetchPage, rowsOf)).toEqual([0, 1])
  })

  it('한 장이 실패하면 받은 데까지 돌려주지 않고 실패를 올린다', async () => {
    const fetchPage = vi.fn(async (page: number): Promise<Page> => {
      if (page === 1) throw new Error('끊김')
      return { rows: [page], size: 1, totalElements: 3 }
    })

    await expect(fetchAllPages(fetchPage, rowsOf)).rejects.toThrow('끊김')
  })
})
