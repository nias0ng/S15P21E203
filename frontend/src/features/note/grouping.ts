import type { Note } from './types'

/**
 * 노트를 대분류로 묶는 규칙.
 *
 * 섹션(화면)과 알약 필터(페이지)가 **같은 기준**을 봐야 해서 컴포넌트 안에 두지
 * 않고 따로 뺐습니다. 한쪽만 '기타' 를 다르게 세면 알약을 눌렀는데 아무 섹션도
 * 안 걸리는 일이 생깁니다.
 */

/** 대분류가 비어 있는 노트도 있습니다. 한 이름으로 묶어 섹션 하나로 둡니다 */
export const UNCATEGORIZED = '기타'

type NoteSection = {
  family: string
  notes: Note[]
}

/** 이 노트가 걸리는 대분류. 비어 있으면 '기타' 입니다 */
const familyOf = (note: Note): string => note.accordFamily ?? UNCATEGORIZED

/**
 * 받은 순서 그대로 대분류가 바뀌는 자리에서 끊습니다.
 *
 * 같은 대분류가 목록에서 떨어져 두 번 나오면 섹션도 둘이 됩니다. 응답이 대분류 순
 * 정렬이라 실제로는 생기지 않지만, 그렇게 되는 편이 **순서가 흐트러진 것을 화면에서
 * 보이게** 합니다 — 몰래 합치면 정렬이 깨진 줄 모르고 넘어갑니다.
 */
export function groupByAccordFamily(notes: Note[]): NoteSection[] {
  const sections: NoteSection[] = []

  for (const note of notes) {
    const family = familyOf(note)
    const last = sections.at(-1)

    if (last?.family === family) last.notes.push(note)
    else sections.push({ family, notes: [note] })
  }

  return sections
}

/**
 * 알약 필터에 쓸 대분류 목록. 섹션과 **같은 순서**입니다.
 *
 * 섹션과 달리 **같은 이름은 한 번만** 내보냅니다. 순서가 흐트러져 같은 대분류가
 * 두 번 나오면 섹션은 둘로 갈라져 그게 눈에 보여야 하지만(`groupByAccordFamily`),
 * 알약은 똑같은 것이 둘 서면 어느 쪽을 눌러야 할지 알 수 없고 누르면 둘 다 켜집니다.
 */
export function noteFamilies(notes: Note[]): string[] {
  const seen = new Set<string>()
  const families: string[] = []

  for (const note of notes) {
    const family = familyOf(note)
    if (seen.has(family)) continue

    seen.add(family)
    families.push(family)
  }

  return families
}

/** 고른 대분류만 남깁니다. 아무것도 안 골랐으면(null) 그대로 돌려줍니다 */
export function filterByFamily(notes: Note[], family: string | null): Note[] {
  if (family === null) return notes
  return notes.filter((note) => familyOf(note) === family)
}
