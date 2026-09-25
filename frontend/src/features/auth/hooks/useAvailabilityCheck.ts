import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

/** 중복 확인을 마친 값과 그 답 */
type Checked = { value: string; available: boolean }

/**
 * 이메일 · 닉네임 [중복 확인] (회원가입 · 정보 변경). 확인한 값과 지금 칸에 든 값이
 * 같을 때만 답을 인정합니다.
 *
 * 값을 고칠 때 답을 지우는 방식으로는 부족합니다 — 확인 요청이 날아가 있는 사이에
 * 값을 고치면, 늦게 도착한 옛 답이 새 값에 붙습니다.
 *
 * @param check 서버에 묻는 함수. 쓸 수 있으면 `true`
 * @param value 지금 칸의 값. 서버가 보는 모양(앞뒤 공백을 뗀 값)으로 넘깁니다
 * @returns `available` 은 지금 값의 답(확인 전이면 `null`), `check` 는 지금 값으로 묻기,
 *   `markTaken` 은 저장 시점의 409 로 지금 값을 쓸 수 없다고 뒤집기, `reset` 은 답 버리기
 */
export function useAvailabilityCheck(
  check: (value: string) => Promise<boolean>,
  value: string,
) {
  const [checked, setChecked] = useState<Checked | null>(null)

  const mutation = useMutation({
    mutationFn: (target: string) => check(target),
    onSuccess: (available, target) => setChecked({ value: target, available }),
  })

  return {
    available:
      checked !== null && checked.value === value ? checked.available : null,
    check: () => mutation.mutate(value),
    isPending: mutation.isPending,
    markTaken: () => setChecked({ value, available: false }),
    reset: () => setChecked(null),
  }
}
