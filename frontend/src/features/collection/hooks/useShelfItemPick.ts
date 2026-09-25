import { useState } from 'react'

/**
 * 진열대 항목 고르기(`ShelfItemPickList`)의 고른 항목과 검색어. 컬렉션 만들기 · 향수 담기 모달이 같이 씁니다.
 *
 * NOTE: `Modal` 이 `<dialog>` 라 닫아도 언마운트되지 않아 모달이 열리고 닫힐 때마다 비웁니다.
 * `useEffect` 가 아니라 렌더 중에 비우는 이유: 한 박자 늦으면 다시 열 때 첫 프레임에 앞서 고른 것이 보입니다.
 *
 * @param open 모달이 열려 있는지
 * @returns 고른 진열대 항목 번호 · 넣고 빼기 · 검색어 · 검색어 바꾸기
 */
export function useShelfItemPick(open: boolean) {
  const [picked, setPicked] = useState<number[]>([])
  const [keyword, setKeyword] = useState('')
  const [openedFor, setOpenedFor] = useState(open)
  if (open !== openedFor) {
    setOpenedFor(open)
    setPicked([])
    setKeyword('')
  }

  const toggle = (shelfItemId: number) =>
    setPicked((prev) =>
      prev.includes(shelfItemId)
        ? prev.filter((id) => id !== shelfItemId)
        : [...prev, shelfItemId],
    )

  return { picked, toggle, keyword, setKeyword }
}
