import { NOTE_CATEGORIES, type Note, type NoteDetail } from './types'

/**
 * ⚠️ 백엔드에 노트 엔드포인트가 아직 없습니다. 화면을 눈으로 확인할 수 있도록
 * 자리표시자를 돌려줍니다. API 가 준비되면 두 함수 본문만 http.get 으로 바꾸세요.
 *
 *   const { data } = await http.get<Note[]>('/notes', { params: { keyword } })
 */
export async function getNotes(keyword = ''): Promise<Note[]> {
  const q = keyword.trim().toLowerCase()
  return PLACEHOLDER_NOTES.filter(
    (note) => !q || note.name.toLowerCase().includes(q),
  )
}

export async function getNoteDetail(noteId: number): Promise<NoteDetail> {
  const note =
    PLACEHOLDER_NOTES.find((item) => item.noteId === noteId) ??
    PLACEHOLDER_NOTES[0]!

  return {
    ...note,
    description:
      '이탈리아 남부에서 자라는 감귤류로, 껍질을 짜면 쌉쌀하면서도 밝은 향이 납니다. 탑 노트에 자주 쓰이며 첫인상을 산뜻하게 만듭니다.',
    perfumeCount: 42,
  }
}

/** ⚠️ 백엔드 API 가 붙으면 이 배열을 통째로 지우세요. */
const PLACEHOLDER_NOTES: Note[] = [
  { noteId: 1, name: '베르가못', category: 'CITRUS', imageUrl: null },
  { noteId: 2, name: '레몬', category: 'CITRUS', imageUrl: null },
  { noteId: 3, name: '자몽', category: 'CITRUS', imageUrl: null },
  { noteId: 4, name: '만다린', category: 'CITRUS', imageUrl: null },
  { noteId: 5, name: '유자', category: 'CITRUS', imageUrl: null },
  { noteId: 6, name: '장미', category: 'FLORAL', imageUrl: null },
  { noteId: 7, name: '자스민', category: 'FLORAL', imageUrl: null },
  { noteId: 8, name: '은방울꽃', category: 'FLORAL', imageUrl: null },
  { noteId: 9, name: '아이리스', category: 'FLORAL', imageUrl: null },
  { noteId: 10, name: '시더우드', category: 'WOOD', imageUrl: null },
  { noteId: 11, name: '샌달우드', category: 'WOOD', imageUrl: null },
  { noteId: 12, name: '베티버', category: 'WOOD', imageUrl: null },
  { noteId: 13, name: '오크모스', category: 'WOOD', imageUrl: null },
  { noteId: 14, name: '핑크 페퍼', category: 'SPICY', imageUrl: null },
  { noteId: 15, name: '시나몬', category: 'SPICY', imageUrl: null },
  { noteId: 16, name: '씨 솔트', category: 'FRESH', imageUrl: null },
  { noteId: 17, name: '민트', category: 'FRESH', imageUrl: null },
  { noteId: 18, name: '바닐라', category: 'SWEET', imageUrl: null },
  { noteId: 19, name: '통카 빈', category: 'SWEET', imageUrl: null },
]

export { NOTE_CATEGORIES }
