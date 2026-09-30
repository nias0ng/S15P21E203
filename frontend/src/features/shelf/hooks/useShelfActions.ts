import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  changeShelfCategory,
  createShelfItem,
  createShelfMemo,
  deleteShelfItem,
  deleteShelfMemo,
  removeShelfFitRating,
  setShelfFitRating,
  updateShelfMemo,
} from '../api'
import { shelfKeys } from '../queries'
import type {
  ShelfCategory,
  ShelfItemDetail,
  ShelfRegisterInput,
} from '../types'

/**
 * 등록이 절반만 끝난 경우.
 *
 * 진열대에 담는 것(`POST`)과 적합도 · 메모(각자 다른 엔드포인트)가 **서버에서 각자
 * 트랜잭션**이라, 담기는 성공했는데 뒤가 실패할 수 있습니다. 담긴 것은 사실이므로
 * 되돌리지 않고, 무엇이 안 들어갔는지 알려줍니다.
 */
/**
 * 빠진 칸. 화면에 적는 이름은 번역 묶음(`shelf:part.<값>`)이 정합니다 — 오류가 만들어질 때의
 * 언어로 굳혀 두면 토스트가 뜰 때 화면 언어와 어긋날 수 있습니다.
 */
export type ShelfPart = 'category' | 'rating' | 'memo'

export class ShelfEditPartialError extends Error {
  readonly missing: ShelfPart[]

  constructor(missing: ShelfPart[]) {
    super(`Shelf edit partially failed: ${missing.join(', ')}`)
    this.name = 'ShelfEditPartialError'
    this.missing = missing
  }
}

export class ShelfRegisterPartialError extends Error {
  readonly missing: Exclude<ShelfPart, 'category'>[]

  constructor(missing: Exclude<ShelfPart, 'category'>[]) {
    super(`Shelf register partially failed: ${missing.join(', ')}`)
    this.name = 'ShelfRegisterPartialError'
    this.missing = missing
  }
}

/**
 * 진열대 항목 하나를 고치는 동작들 (SHF-03 · SHF-05 · SHF-12).
 *
 * 화면이 아니라 여기 모은 이유: 셋 다 **누르는 즉시 반영되어야 하고**(낙관적 갱신)
 * 실패하면 되돌려야 하는데, 그 규칙이 조작마다 조금씩 다릅니다. 화면에 흩어 두면
 * 한 군데만 되돌리기를 빠뜨려도 티가 나지 않습니다.
 *
 * 토스트는 화면 몫입니다. `mutate(값, { onSuccess, onError })` 로 넘기세요 —
 * 진열대 도메인이 토스트를 알 필요는 없습니다.
 */
export function useShelfActions() {
  const queryClient = useQueryClient()

  /** 상세 캐시 한 칸을 고칩니다. 아직 안 받았으면 그냥 둡니다 */
  const patchDetail = (
    shelfItemId: number,
    patch: (item: ShelfItemDetail) => ShelfItemDetail,
  ) =>
    queryClient.setQueryData<ShelfItemDetail>(
      shelfKeys.detail(shelfItemId),
      (item) => (item === undefined ? item : patch(item)),
    )

  /**
   * 취향 적합도 (SHF-12).
   *
   * 적합도는 **상세에만** 있는 값이라 목록은 건드리지 않습니다. 점수를 맞춰 보느라
   * 여러 번 누르게 되므로 누르는 즉시 원이 차야 합니다 — 응답을 기다리면 손가락보다
   * 느리게 반응합니다.
   *
   * 해제(`DELETE .../fit-rating`)는 여기 없습니다 — [변경하기] 모달에서만 하므로
   * `edit` 이 처리합니다.
   */
  const rating = useMutation({
    mutationFn: ({
      shelfItemId,
      rating,
    }: {
      shelfItemId: number
      rating: number
    }) => setShelfFitRating(shelfItemId, rating),

    onMutate: async ({ shelfItemId, rating }) => {
      // 진행 중인 상세 요청이 뒤늦게 도착해 방금 누른 값을 덮지 않도록 멈춥니다
      await queryClient.cancelQueries({
        queryKey: shelfKeys.detail(shelfItemId),
      })
      const previous = queryClient.getQueryData<ShelfItemDetail>(
        shelfKeys.detail(shelfItemId),
      )
      patchDetail(shelfItemId, (item) => ({ ...item, rating }))
      return { previous }
    },

    onError: (_error, { shelfItemId }, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          shelfKeys.detail(shelfItemId),
          context.previous,
        )
      }
    },

    // 서버가 실제로 저장한 값으로 맞춥니다 (반올림 규칙이 다를 수 있습니다)
    onSuccess: (result, { shelfItemId }) =>
      patchDetail(shelfItemId, (item) => ({
        ...item,
        rating: result.fitRating,
      })),
  })

  /**
   * 진열대에 담기 (SHF-01).
   *
   * **요청이 최대 세 개입니다.** 서버가 담기 · 적합도 · 메모를 따로 받습니다.
   *
   *   POST   /users/me/shelf-items                { perfumeId, ownershipStatus }
   *   PUT    /users/me/shelf-items/{id}/fit-rating   ← 적합도를 매겼으면
   *   POST   /users/me/shelf-items/{id}/memo         ← 메모를 적었으면
   *
   * 담기가 성공한 뒤 뒤가 실패해도 **되돌리지 않습니다.** 향수는 이미 진열대에 있고,
   * 그걸 지우면 사용자가 방금 한 일이 통째로 사라집니다. 대신 무엇이 빠졌는지
   * 알려주고, 비어 있는 값은 상세 화면에서 다시 채우면 됩니다.
   */
  const register = useMutation({
    mutationFn: async (input: ShelfRegisterInput) => {
      const created = await createShelfItem(input.perfumeId, input.category)
      const missing: Exclude<ShelfPart, 'category'>[] = []

      if (input.rating !== null) {
        try {
          await setShelfFitRating(created.shelfItemId, input.rating)
        } catch {
          missing.push('rating')
        }
      }

      const memo = input.memo?.trim()
      if (memo) {
        try {
          await createShelfMemo(created.shelfItemId, memo)
        } catch {
          missing.push('memo')
        }
      }

      if (missing.length > 0) throw new ShelfRegisterPartialError(missing)
      return created
    },

    // 담기 자체가 실패했어도 목록은 다시 받습니다 — 절반만 들어갔을 수 있습니다
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: shelfKeys.items() })
    },
  })

  /**
   * 진열대에서 빼기 (SHF-04).
   *
   * 지운 항목의 상세 캐시도 함께 버립니다. 남겨 두면 앞뒤로 넘기다가 이미 없는
   * 향수의 패널이 잠깐 뜹니다.
   */
  const remove = useMutation({
    mutationFn: ({ shelfItemId }: { shelfItemId: number }) =>
      deleteShelfItem(shelfItemId),

    onSuccess: (_result, { shelfItemId }) => {
      queryClient.removeQueries({ queryKey: shelfKeys.detail(shelfItemId) })
      void queryClient.invalidateQueries({ queryKey: shelfKeys.items() })
    },
  })

  /**
   * 카드의 [변경하기] — 분류 · 적합도 · 메모를 한 번에 (C02).
   *
   * **바뀐 것만 보냅니다.** 셋이 서로 다른 엔드포인트라 그대로 다 보내면 요청이
   * 늘 세 개가 되고, 안 건드린 메모까지 수정으로 기록되어 "마지막으로 쓴 날" 이
   * 엉뚱하게 갱신됩니다.
   *
   * 여기도 트랜잭션이 아닙니다. 앞이 성공하고 뒤가 실패하면 절반만 반영된 채로
   * 끝나므로, 무엇이 빠졌는지 알려주고 목록 · 상세를 다시 받아 **화면이 서버의
   * 실제 상태를 보여주게** 합니다.
   */
  const edit = useMutation({
    mutationFn: async ({
      shelfItemId,
      before,
      next,
    }: {
      shelfItemId: number
      before: ShelfItemDetail
      next: {
        category: ShelfCategory
        rating: number | null
        memo: string | null
      }
    }) => {
      const missing: ShelfPart[] = []

      if (next.category !== before.category) {
        try {
          await changeShelfCategory(shelfItemId, next.category)
        } catch {
          missing.push('category')
        }
      }

      if (next.rating !== before.rating) {
        try {
          // null 은 [해제] — 매긴 것을 지웁니다
          if (next.rating === null) await removeShelfFitRating(shelfItemId)
          else await setShelfFitRating(shelfItemId, next.rating)
        } catch {
          missing.push('rating')
        }
      }

      /*
       * **양쪽을 같은 방법으로 다듬어 견줍니다.** 보내는 값은 화면이 `trim()` 한
       * 것인데 서버가 준 값은 다듬지 않은 원본입니다 — 백엔드 `MemoRequest` 에
       * trim 이 없어 앞뒤 공백이 그대로 저장됩니다. 그대로 비교하면 저장된 메모가
       * "출근용 " 일 때 손대지 않고 [변경] 만 눌러도 달라 보여서, 같은 글을 다시
       * 쓰는 요청이 나가고 "마지막으로 쓴 날" 까지 갱신됩니다.
       */
      const beforeMemo = before.memo?.trim() || null

      if (next.memo !== beforeMemo) {
        try {
          if (next.memo === null) await deleteShelfMemo(shelfItemId)
          else if (beforeMemo === null)
            await createShelfMemo(shelfItemId, next.memo)
          else await updateShelfMemo(shelfItemId, next.memo)
        } catch {
          missing.push('memo')
        }
      }

      if (missing.length > 0) throw new ShelfEditPartialError(missing)
    },

    /*
     * 성공이든 실패든 다시 받습니다. 분류를 옮기면 향수가 다른 칸으로 걸어가고,
     * 절반만 반영된 경우에는 화면이 무엇이 남았는지 스스로 알 수 없습니다.
     */
    onSettled: (_data, _error, { shelfItemId }) => {
      void queryClient.invalidateQueries({ queryKey: shelfKeys.items() })
      void queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(shelfItemId),
      })
    },
  })

  return { rating, register, remove, edit }
}
