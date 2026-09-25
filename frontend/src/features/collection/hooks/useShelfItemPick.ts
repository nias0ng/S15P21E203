import { useState } from 'react'

import { useResetOnOpen } from '@/shared/hooks/useResetOnOpen'

/**
 * 진열대 항목 고르기(`ShelfItemPickList`)의 고른 항목과 검색어. 컬렉션 만들기 · 향수 담기 모달이 같이 씁니다.
 *
 * NOTE: `Modal` 이 `<dialog>` 라 닫아도 언마운트되지 않아 모달이 열리고 닫힐 때마다 비웁니다.
 *
 * @param open 모달이 열려 있는지
 * @returns 고른 진열대 항목 번호 · 넣고 빼기 · 검색어 · 검색어 바꾸기
 */
export function useShelfItemPick(open: boolean) {
  const [picked, setPicked] = useState<number[]>([])
  const [keyword, setKeyword] = useState('')
  useResetOnOpen(open ? 'open' : null, () => {
    setPicked([])
    setKeyword('')
  })

  const toggle = (shelfItemId: number) =>
    setPicked((prev) =>
      prev.includes(shelfItemId)
        ? prev.filter((id) => id !== shelfItemId)
        : [...prev, shelfItemId],
    )

  return { picked, toggle, keyword, setKeyword }
}
