import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  addCollectionPerfume,
  createCollection,
  deleteCollection,
  removeCollectionPerfume,
  updateCollection,
} from '../api'
import { collectionKeys } from '../queries'
import type { CollectionCreateInput, CollectionInput } from '../types'

/**
 * 향수 여러 개를 넣다가 일부만 들어간 경우.
 *
 * 서버가 향수를 한 번에 하나씩 받아 **요청마다 따로 저장**됩니다. 들어간 것은 되돌리지
 * 않고 몇 개가 빠졌는지 알려줍니다 — 되돌리면 사용자가 고른 것이 통째로 사라집니다.
 */
export class CollectionAddPartialError extends Error {
  readonly added: number
  readonly failed: number

  constructor(added: number, failed: number) {
    super(`${failed}개를 추가하지 못했습니다`)
    this.name = 'CollectionAddPartialError'
    this.added = added
    this.failed = failed
  }
}

/**
 * 컬렉션을 고치는 동작들 (COL-01 · COL-03 ~ COL-06).
 *
 * 전부 끝나면 **서버에서 다시 받습니다.** 목록 카드의 향수 수 · 미리보기 사진이 상세의
 * 향수 구성에서 나오므로, 화면이 미리 계산해 두면 둘 중 하나가 어긋납니다.
 *
 * 토스트는 화면 몫입니다. `mutate(값, { onSuccess, onError })` 로 넘기세요.
 */
export function useCollectionActions() {
  const queryClient = useQueryClient()

  /** 목록과, 알면 그 컬렉션의 상세를 다시 받습니다 */
  const refresh = (collectionId?: number) => {
    void queryClient.invalidateQueries({ queryKey: collectionKeys.mine() })
    if (collectionId !== undefined) {
      void queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(collectionId),
      })
    }
  }

  /** 만들기 (COL-01). 이름이 겹치면 409 — 화면은 모달을 닫지 않고 알려줍니다 */
  const create = useMutation({
    mutationFn: (input: CollectionCreateInput) => createCollection(input),
    onSuccess: () => refresh(),
  })

  /** 제목 · 설명 수정 (COL-05) */
  const update = useMutation({
    mutationFn: ({
      collectionId,
      input,
    }: {
      collectionId: number
      input: CollectionInput
    }) => updateCollection(collectionId, input),
    onSettled: (_data, _error, { collectionId }) => refresh(collectionId),
  })

  /**
   * 삭제 (COL-06). 지운 컬렉션의 상세는 다시 받을 곳이 없어(404) 캐시에서 버립니다.
   */
  const remove = useMutation({
    mutationFn: ({ collectionId }: { collectionId: number }) =>
      deleteCollection(collectionId),
    onSuccess: (_data, { collectionId }) => {
      queryClient.removeQueries({
        queryKey: collectionKeys.detail(collectionId),
      })
      void queryClient.invalidateQueries({ queryKey: collectionKeys.mine() })
    },
  })

  /**
   * 향수 넣기 (COL-03) — 고른 만큼 **차례로** 보냅니다.
   *
   * 서버가 마지막 순서에 붙이므로 한꺼번에 보내면 고른 순서와 담긴 순서가 뒤섞입니다.
   * 하나도 못 넣었으면 첫 에러를 그대로 던져 서버 문구(예: 이미 담긴 향수)를 보여줄 수 있게 합니다.
   */
  const addPerfumes = useMutation({
    mutationFn: async ({
      collectionId,
      shelfItemIds,
    }: {
      collectionId: number
      shelfItemIds: number[]
    }) => {
      let added = 0
      let firstError: unknown = null

      for (const shelfItemId of shelfItemIds) {
        try {
          await addCollectionPerfume(collectionId, shelfItemId)
          added += 1
        } catch (error) {
          firstError ??= error
        }
      }

      const failed = shelfItemIds.length - added
      if (failed > 0 && added === 0) throw firstError
      if (failed > 0) throw new CollectionAddPartialError(added, failed)
      return added
    },
    // 일부만 들어갔을 수 있어 실패해도 다시 받습니다
    onSettled: (_data, _error, { collectionId }) => refresh(collectionId),
  })

  /** 향수 빼기 (COL-04). 마지막 향수면 서버가 409 로 막습니다 */
  const removePerfume = useMutation({
    mutationFn: ({
      collectionId,
      shelfItemId,
    }: {
      collectionId: number
      shelfItemId: number
    }) => removeCollectionPerfume(collectionId, shelfItemId),
    onSettled: (_data, _error, { collectionId }) => refresh(collectionId),
  })

  return { create, update, remove, addPerfumes, removePerfume }
}
