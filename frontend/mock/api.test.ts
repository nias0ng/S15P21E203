import { beforeEach, describe, expect, it } from 'vitest'

import { createMockApi, type MockRequest } from './api.ts'
import { MOCK_PERFUMES } from './catalog.ts'
import { SHELF_SEED } from './seed.ts'

type Api = ReturnType<typeof createMockApi>

function call(
  api: Api,
  method: string,
  path: string,
  request: Partial<MockRequest> & { search?: string } = {},
) {
  const route = api.find(method, path)
  if (route === null) throw new Error(`목데이터에 없는 경로: ${method} ${path}`)

  return route({
    query: new URLSearchParams(request.search ?? ''),
    body: request.body,
    loggedIn: request.loggedIn ?? true,
  })
}

/** 응답 본문을 테스트에서 읽을 모양으로 */
const bodyOf = <T>(response: { body?: unknown }) => response.body as T

interface ShelfList {
  perfumes: {
    shelfItemId: number
    perfumeId: number
    thumbnailUrl: string
    representative: boolean
  }[]
  totalElements: number
}

describe('목데이터 API', () => {
  let api: Api

  beforeEach(() => {
    api = createMockApi({
      shelfImageUrl: (perfume) => `/bottles/${perfume.rank}.png`,
      now: () => new Date('2026-09-17T00:00:00Z'),
    })
  })

  it('seed 의 향수가 모두 catalog 에 있다', () => {
    const ids = new Set(MOCK_PERFUMES.map((perfume) => perfume.perfumeId))
    expect(SHELF_SEED.every((seed) => ids.has(seed.perfumeId))).toBe(true)
  })

  it('모르는 경로는 받지 않아 백엔드 프록시로 넘어간다', () => {
    expect(api.find('GET', '/brands')).toBeNull()
    expect(api.find('GET', '/perfumes/65738')).toBeNull()
    expect(api.find('PUT', '/users/me/collections')).toBeNull()
  })

  describe('로그인', () => {
    it('아무 이메일 · 비밀번호로 토큰을 받는다', () => {
      const response = call(api, 'POST', '/auth/login', {
        body: { email: 'a@b.c', password: 'whatever1' },
        loggedIn: false,
      })

      expect(response.status).toBe(200)
      expect(bodyOf<{ accessToken: string }>(response).accessToken).toBeTruthy()
    })

    it('토큰 없이 내 정보 · 진열대 · 향해 일지를 부르면 401 이다', () => {
      for (const path of [
        '/users/me',
        '/users/me/shelf-items',
        '/users/me/collections',
        '/map/exploration-logs',
      ]) {
        expect(call(api, 'GET', path, { loggedIn: false }).status).toBe(401)
      }
    })
  })

  describe('진열대', () => {
    it('보유 중 · 시향해 봄 · 보유 희망이 10병씩이고 대표는 하나다', () => {
      const lists = ['OWNED', 'TRIED', 'WISH'].map((category) =>
        bodyOf<ShelfList>(
          call(api, 'GET', '/users/me/shelf-items', {
            search: `category=${category}&page=0&size=100`,
          }),
        ),
      )

      expect(lists.map((list) => list.totalElements)).toEqual([10, 10, 10])
      expect(
        lists
          .flatMap((list) => list.perfumes)
          .filter((item) => item.representative),
      ).toHaveLength(1)
      // 진열대 사진은 종이 질감 쪽(shelfImageUrl)을 씁니다
      expect(lists[0]?.perfumes[0]?.thumbnailUrl).toMatch(/^\/bottles\//)
    })

    it('분류 없이 부르면 400 이다', () => {
      expect(call(api, 'GET', '/users/me/shelf-items').status).toBe(400)
    })

    it('담으면 목록에 붙고, 같은 향수를 또 담으면 409 다', () => {
      const perfumeId = 83 // Green Tea — seed 진열대에 없습니다
      const created = call(api, 'POST', '/users/me/shelf-items', {
        body: { perfumeId, ownershipStatus: 'WISH' },
      })

      expect(created.status).toBe(201)
      expect(
        call(api, 'POST', '/users/me/shelf-items', {
          body: { perfumeId, ownershipStatus: 'OWNED' },
        }).status,
      ).toBe(409)

      const wish = bodyOf<ShelfList>(
        call(api, 'GET', '/users/me/shelf-items', { search: 'category=WISH' }),
      )
      expect(wish.totalElements).toBe(11)
      expect(wish.perfumes.at(-1)?.perfumeId).toBe(perfumeId)
    })

    it('대표 향수를 보유 중 밖으로 옮기면 대표가 풀린다', () => {
      const representative = SHELF_SEED.find((seed) => seed.representative)!

      call(
        api,
        'PATCH',
        `/users/me/shelf-items/${representative.shelfItemId}/ownership`,
        {
          body: { ownershipStatus: 'TRIED' },
        },
      )

      const detail = bodyOf<{ representative: boolean; category: string }>(
        call(api, 'GET', `/users/me/shelf-items/${representative.shelfItemId}`),
      )
      expect(detail).toMatchObject({ representative: false, category: 'TRIED' })
    })

    it('보유 중이 아닌 향수는 대표로 지정할 수 없다', () => {
      const tried = SHELF_SEED.find((seed) => seed.category === 'TRIED')!

      expect(
        call(
          api,
          'PATCH',
          `/users/me/shelf-items/${tried.shelfItemId}/representative`,
          {
            body: { representative: true },
          },
        ).status,
      ).toBe(400)
    })

    it('적합도는 1.0~5.0 을 0.5 단위로만 받는다', () => {
      const path = '/users/me/shelf-items/2/fit-rating'

      expect(call(api, 'PUT', path, { body: { fitRating: 4.5 } }).status).toBe(
        200,
      )
      expect(call(api, 'PUT', path, { body: { fitRating: 4.2 } }).status).toBe(
        400,
      )
      expect(call(api, 'PUT', path, { body: { fitRating: 0.5 } }).status).toBe(
        400,
      )
    })

    it('메모가 있으면 작성은 409, 없으면 수정은 404 다', () => {
      const withMemo = SHELF_SEED.find((seed) => seed.memo !== null)!
      const withoutMemo = SHELF_SEED.find((seed) => seed.memo === null)!

      expect(
        call(
          api,
          'POST',
          `/users/me/shelf-items/${withMemo.shelfItemId}/memo`,
          {
            body: { content: '새 메모' },
          },
        ).status,
      ).toBe(409)
      expect(
        call(
          api,
          'PATCH',
          `/users/me/shelf-items/${withoutMemo.shelfItemId}/memo`,
          {
            body: { content: '새 메모' },
          },
        ).status,
      ).toBe(404)
    })
  })

  describe('컬렉션', () => {
    it('여섯 개를 최신 것부터 준다', () => {
      const body = bodyOf<{ collections: { collectionId: number }[] }>(
        call(api, 'GET', '/users/me/collections', {
          search: 'page=0&size=100',
        }),
      )

      expect(body.collections.map((item) => item.collectionId)).toEqual([
        6, 5, 4, 3, 2, 1,
      ])
    })

    it('마지막 향수는 뺄 수 없고, 그 향수를 진열대에서 빼는 것도 막힌다', () => {
      const created = bodyOf<{ collectionId: number }>(
        call(api, 'POST', '/users/me/collections', {
          body: { name: '하나만', description: null, shelfItemIds: [2] },
        }),
      )
      const path = `/users/me/collections/${created.collectionId}/perfumes/2`

      expect(call(api, 'DELETE', path).status).toBe(409)
      expect(call(api, 'DELETE', '/users/me/shelf-items/2').status).toBe(409)
    })

    it('이름이 겹치거나 향수 없이 만들면 거절한다', () => {
      expect(
        call(api, 'POST', '/users/me/collections', {
          body: { name: '비 오는 날', shelfItemIds: [2] },
        }).status,
      ).toBe(409)
      expect(
        call(api, 'POST', '/users/me/collections', {
          body: { name: '빈 컬렉션', shelfItemIds: [] },
        }).status,
      ).toBe(400)
    })

    it('상세의 향수 사진도 종이 질감 쪽을 쓴다', () => {
      const detail = bodyOf<{ perfumes: { thumbnailUrl: string }[] }>(
        call(api, 'GET', '/users/me/collections/1'),
      )

      expect(detail.perfumes.length).toBeGreaterThan(0)
      expect(
        detail.perfumes.every((perfume) =>
          perfume.thumbnailUrl.startsWith('/bottles/'),
        ),
      ).toBe(true)
    })
  })

  describe('향해 일지 · 향수 검색', () => {
    it('향해 일지는 최근 진입부터 size 만큼 준다', () => {
      const body = bodyOf<{
        entries: { entryId: number; enteredAt: string }[]
      }>(call(api, 'GET', '/map/exploration-logs', { search: 'size=5' }))

      expect(body.entries).toHaveLength(5)
      const times = body.entries.map((entry) => Date.parse(entry.enteredAt))
      expect([...times].sort((a, b) => b - a)).toEqual(times)
    })

    it('검색어는 공백 · 대소문자를 무시하고 한글 이름에도 걸린다', () => {
      const search = (keyword: string) =>
        bodyOf<{ perfumes: { perfumeId: number; imageUrl: string }[] }>(
          call(api, 'GET', '/perfumes', {
            search: `keyword=${encodeURIComponent(keyword)}`,
            loggedIn: false,
          }),
        ).perfumes.map((perfume) => perfume.perfumeId)

      expect(search('woodsage')).toContain(74041)
      expect(search('상탈')).toContain(12201)
    })
  })
})
