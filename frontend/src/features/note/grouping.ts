import type { Note } from './types'

/** 노트 대분류 묶기. 섹션과 알약 필터가 같은 기준을 봐야 해서 한곳에 모았습니다 */

/** 대분류가 비어 있는 노트도 있습니다 */
export const UNCATEGORIZED = '기타'

type NoteSection = {
  family: string
  notes: Note[]
}

const familyOf = (note: Note): string => note.accordFamily ?? UNCATEGORIZED

/** 같은 대분류가 떨어져 두 번 나오면 섹션도 둘입니다 — 순서가 흐트러진 것이 보여야 합니다 */
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

/** 섹션과 달리 같은 이름은 한 번만 냅니다 — 알약이 둘 서면 누르는 쪽을 가릴 수 없습니다 */
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

export function filterByFamily(notes: Note[], family: string | null): Note[] {
  if (family === null) return notes
  return notes.filter((note) => familyOf(note) === family)
}
