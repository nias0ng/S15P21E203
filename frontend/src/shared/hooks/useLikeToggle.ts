import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { useIsLoggedIn } from '@/shared/store/authStore'

/**
 * 좋아요 응답이 공통으로 담고 있는 것.
 *
 * 서버가 **누른 결과와 바뀐 수를 함께** 돌려주므로 화면이 숫자를 직접 더하고 빼지
 * 않습니다 — 그 사이 다른 사람이 누른 것도 같이 반영됩니다.
 */
type LikeResult = { liked: boolean; likeCount: number }

/** 지금 줄의 상태. 무엇을 누를지(누르기 / 취소)는 이 값이 정합니다 */
type LikeTarget = { id: number; liked: boolean }

type Options<TResult extends LikeResult> = {
  like: (id: number) => Promise<TResult>
  unlike: (id: number) => Promise<TResult>
  /** 응답이 왔을 때 캐시를 고치는 일. 무엇을 고칠지는 화면마다 달라 밖에서 받습니다 */
  onToggled?: (result: TResult) => void
}

/**
 * 좋아요 토글 (CMT-05).
 *
 * 후기 게시판 · 자유 게시판 · 후기 상세가 같은 일을 하고 있었습니다 — 비로그인이면
 * 안내부터 띄우고, 로그인했으면 지금 상태의 반대를 부르는 것. 셋이 각자 쓰다 보니
 * **후기 상세에는 한동안 로그인 안내가 없어서** 비로그인으로 누르면 401 만 났습니다.
 *
 * 비로그인일 때 보내 보지 않는 이유: 401 이 나면 인터셉터가 재발급을 시도하다
 * 세션을 정리해, 사용자에게는 "왜 안 되지" 만 남습니다.
 *
 * **캐시를 고치는 일은 하지 않습니다.** 게시판은 그 줄만 덮어쓰고 상세는 그 글만
 * 덮어쓰는데, 목록 전체를 다시 부르면 보고 있던 자리가 흔들리고 정렬이 '좋아요순'
 * 이면 방금 누른 줄이 눈앞에서 이동합니다. 무엇을 고칠지는 화면이 압니다.
 *
 * 서버가 멱등이라(이미 누른 것에 또 눌러도 같은 결과) 따닥 누름을 막지 않습니다.
 */
export function useLikeToggle<TResult extends LikeResult>({
  like,
  unlike,
  onToggled,
}: Options<TResult>) {
  const isLoggedIn = useIsLoggedIn()
  const [loginRequired, setLoginRequired] = useState(false)

  const mutation = useMutation({
    mutationFn: ({ id, liked }: LikeTarget) => (liked ? unlike(id) : like(id)),
    /*
      `onSuccess: onToggled` 로 그대로 넘기지 않습니다 — TanStack 은 두 번째 · 세 번째
      인자로 variables 와 context 를 함께 넘기는데, 부르는 쪽이 쓰지도 않는 값이
      딸려 오면 나중에 인자를 하나 더 받는 함수를 넘겼을 때 조용히 엉뚱하게 맞습니다.
    */
    onSuccess: (data) => onToggled?.(data),
  })

  const toggle = (target: LikeTarget) => {
    if (!isLoggedIn) {
      setLoginRequired(true)
      return
    }
    mutation.mutate(target)
  }

  /*
    `LoginRequiredDialog` 의 `onClose` 로 그대로 넘어가는 값이라 `useCallback` 으로
    고정합니다. 인라인 화살표를 넘기면 렌더마다 새 함수가 되어, 모달이 그 값을
    의존성에 쓰는 순간 조용히 다시 열리고 닫힙니다(`useToast` 와 같은 이유).
  */
  const closeLoginRequired = useCallback(() => setLoginRequired(false), [])

  return {
    toggle,
    /** 비로그인으로 눌렀는지. `LoginRequiredDialog` 의 `open` 에 그대로 넘깁니다 */
    loginRequired,
    closeLoginRequired,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}
