import { queryOptions } from '@tanstack/react-query'

import { getShelfItemDetail, getShelfItems } from './api'

export const shelfKeys = {
  all: ['shelf'] as const,
  items: () => [...shelfKeys.all, 'items'] as const,
  detail: (shelfItemId: number) =>
    [...shelfKeys.all, 'detail', shelfItemId] as const,
}

export const shelfItemsQuery = () =>
  queryOptions({
    queryKey: shelfKeys.items(),
    queryFn: getShelfItems,
  })

/**
 * 고른 한 병의 상세. 적합도 · 메모 · 향조가 여기에만 있습니다.
 *
 * 카드를 넘길 때마다 부르지만 캐시가 병마다 따로 남아, 앞뒤로 오가면 두 번째부터는
 * 즉시 뜹니다. 화면은 목록 값으로 먼저 그려 두므로 기다리는 동안에도 비지 않습니다.
 */
export const shelfItemDetailQuery = (shelfItemId: number) =>
  queryOptions({
    queryKey: shelfKeys.detail(shelfItemId),
    queryFn: () => getShelfItemDetail(shelfItemId),
  })
