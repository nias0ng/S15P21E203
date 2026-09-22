import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getBrands } from './api'
import { brandListQuery } from './queries'
import { DEFAULT_BRAND_SORT, SERVER_DEFAULT_BRAND_SORT } from './types'

vi.mock('./api', () => ({
  getBrands: vi.fn(async () => []),
  getBrand: vi.fn(async () => ({})),
}))

/** `queryFn` 은 react-query 가 넘기는 맥락을 쓰지 않아 빈 값으로 부릅니다. */
const run = (params: Parameters<typeof brandListQuery>[0]) => {
  const { queryFn } = brandListQuery(params)
  return (queryFn as () => Promise<unknown>)()
}

beforeEach(() => {
  vi.mocked(getBrands).mockClear()
})

describe('brandListQuery', () => {
  it('화면 기본 정렬은 서버 기본값과 달라서 요청에 실린다', async () => {
    expect(DEFAULT_BRAND_SORT).not.toBe(SERVER_DEFAULT_BRAND_SORT)

    await run({ keyword: '', sort: DEFAULT_BRAND_SORT })

    expect(getBrands).toHaveBeenCalledWith({ sort: DEFAULT_BRAND_SORT })
  })

  it('서버 기본 정렬이면 요청에서 뺀다', async () => {
    await run({ keyword: '', sort: SERVER_DEFAULT_BRAND_SORT })

    expect(getBrands).toHaveBeenCalledWith({})
  })

  it('빈 검색어는 요청에서 뺀다', async () => {
    await run({ keyword: '   ', sort: SERVER_DEFAULT_BRAND_SORT })

    expect(getBrands).toHaveBeenCalledWith({})
  })

  it('서버 기본 정렬과 정렬 없음은 캐시 자리를 함께 쓴다', () => {
    expect(
      brandListQuery({ sort: SERVER_DEFAULT_BRAND_SORT }).queryKey,
    ).toEqual(brandListQuery({}).queryKey)
  })

  it('화면 기본 정렬은 정렬 없음과 캐시 자리를 나눈다', () => {
    expect(brandListQuery({ sort: DEFAULT_BRAND_SORT }).queryKey).not.toEqual(
      brandListQuery({}).queryKey,
    )
  })
})
