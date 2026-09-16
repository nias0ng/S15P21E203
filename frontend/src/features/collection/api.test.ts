import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/shared/api/http'

import {
  createCollection,
  getCollectionDetail,
  getMyCollections,
  updateCollection,
} from './api'

vi.mock('@/shared/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const get = vi.mocked(http.get)
const post = vi.mocked(http.post)
const patch = vi.mocked(http.patch)

/** axios 응답 모양으로 감쌉니다. 화면 코드는 `data` 만 읽습니다 */
const reply = (data: unknown) => Promise.resolve({ data } as never)

const summary = (collectionId: number, perfumeCount: number) => ({
  collectionId,
  name: `컬렉션 ${collectionId}`,
  description: null,
  perfumeCount,
  createdAt: '2026-09-16T00:00:00Z',
  updatedAt: '2026-09-16T00:00:00Z',
})

const perfume = (shelfItemId: number, thumbnailUrl: string | null) => ({
  shelfItemId,
  perfumeId: shelfItemId + 1000,
  name: `Perfume ${shelfItemId}`,
  brand: 'Brand',
  thumbnailUrl,
})

describe('컬렉션 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('목록은 name 을 title 로 옮기고 미리보기를 늘 3칸으로 채운다', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/users/me/collections') {
        return reply({
          collections: [summary(2, 2), summary(1, 0)],
          page: 0,
          size: 100,
          totalElements: 2,
        })
      }
      if (url === '/users/me/collections/2') {
        return reply({
          ...summary(2, 2),
          perfumes: [perfume(11, 'a.png'), perfume(12, null)],
        })
      }
      throw new Error(`예상하지 못한 요청: ${url}`)
    })

    const result = await getMyCollections()

    expect(result).toEqual([
      {
        collectionId: 2,
        title: '컬렉션 2',
        description: null,
        perfumeCount: 2,
        previewThumbnails: ['a.png', null, null],
      },
      {
        collectionId: 1,
        title: '컬렉션 1',
        description: null,
        perfumeCount: 0,
        previewThumbnails: [null, null, null],
      },
    ])
    // 향수가 없는 컬렉션은 상세를 부르지 않습니다
    expect(get).not.toHaveBeenCalledWith('/users/me/collections/1')
  })

  it('목록이 한 장을 넘으면 뒷장을 이어 받는다', async () => {
    get.mockImplementation((url: string, config?: unknown) => {
      const page = (config as { params: { page: number } }).params.page
      if (url !== '/users/me/collections') throw new Error(url)
      return reply({
        collections: page === 0 ? [summary(3, 0)] : [summary(4, 0)],
        page,
        size: 1,
        totalElements: 2,
      })
    })

    const result = await getMyCollections()

    expect(result.map((item) => item.collectionId)).toEqual([3, 4])
  })

  it('상세 하나가 실패해도 목록은 그 카드만 빈 칸으로 그린다', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/users/me/collections') {
        return reply({
          collections: [summary(5, 1)],
          page: 0,
          size: 100,
          totalElements: 1,
        })
      }
      return Promise.reject(new Error('상세 실패'))
    })

    const [card] = await getMyCollections()

    expect(card?.previewThumbnails).toEqual([null, null, null])
    expect(card?.perfumeCount).toBe(1)
  })

  it('상세는 담긴 향수를 세고 진열대 항목 번호를 남긴다', async () => {
    get.mockImplementation(() =>
      reply({
        ...summary(7, 99),
        description: '설명',
        perfumes: [perfume(21, 'x.png')],
      }),
    )

    const detail = await getCollectionDetail(7)

    expect(detail.title).toBe('컬렉션 7')
    expect(detail.perfumeCount).toBe(1)
    expect(detail.perfumes).toEqual([perfume(21, 'x.png')])
  })

  it('만들기는 title 을 name 으로, 고른 진열대 항목을 함께 보낸다', async () => {
    post.mockImplementation(() => reply({}))

    await createCollection({
      title: '출근용',
      description: null,
      shelfItemIds: [3, 1],
    })

    expect(post).toHaveBeenCalledWith('/users/me/collections', {
      name: '출근용',
      description: null,
      shelfItemIds: [3, 1],
    })
  })

  it('수정은 두 칸을 함께 보내 설명을 비우면 지워지게 한다', async () => {
    patch.mockImplementation(() => reply(undefined))

    await updateCollection(9, { title: '주말', description: null })

    expect(patch).toHaveBeenCalledWith('/users/me/collections/9', {
      name: '주말',
      description: null,
    })
  })
})
