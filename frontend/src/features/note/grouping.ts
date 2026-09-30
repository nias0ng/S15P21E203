import type { Note } from './types'

// 묶음 열쇠이자 주소(`?family=`)에 실리는 값이라 한국어로 두고, 화면에 보일 때만 바꿉니다
export const UNCATEGORIZED = '기타'

type NoteSection = {
  family: string
  notes: Note[]
}

const familyOf = (note: Note): string => note.accordFamily ?? UNCATEGORIZED

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
