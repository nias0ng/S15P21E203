import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

type Checked = { value: string; available: boolean }

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
