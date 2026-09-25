import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { useIsLoggedIn } from '@/shared/store/authStore'

type LikeResult = { liked: boolean; likeCount: number }

type LikeTarget = { id: number; liked: boolean }

type Options<TResult extends LikeResult> = {
  like: (id: number) => Promise<TResult>
  unlike: (id: number) => Promise<TResult>
  onToggled?: (result: TResult) => void
}

export function useLikeToggle<TResult extends LikeResult>({
  like,
  unlike,
  onToggled,
}: Options<TResult>) {
  const isLoggedIn = useIsLoggedIn()
  const [loginRequired, setLoginRequired] = useState(false)

  const mutation = useMutation({
    mutationFn: ({ id, liked }: LikeTarget) => (liked ? unlike(id) : like(id)),
    onSuccess: (data) => onToggled?.(data),
  })

  const toggle = (target: LikeTarget) => {
    if (!isLoggedIn) {
      setLoginRequired(true)
      return
    }
    mutation.mutate(target)
  }

  const closeLoginRequired = useCallback(() => setLoginRequired(false), [])

  return {
    toggle,
    loginRequired,
    closeLoginRequired,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}
