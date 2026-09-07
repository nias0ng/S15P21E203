/**
 * 노트 도메인 타입 (와이어프레임 A35 · A36)
 *
 * ⚠️ 노트는 기능 명세서에 요구사항 ID 가 없는 신규 화면입니다(명세서 이후 수정 예정).
 * 백엔드 API 도 아직 없습니다.
 */

/**
 * 노트 대분류.
 *
 * 와이어프레임 주석: "대분류(CITRUS · WOOD · FLORAL …)로 묶어 세로로 쌓는다 —
 * 대분류 순서는 고정". 그래서 알파벳 순이 아니라 이 배열의 순서를 그대로 씁니다.
 */
export const NOTE_CATEGORIES = [
  'CITRUS',
  'FLORAL',
  'WOOD',
  'SPICY',
  'FRESH',
  'SWEET',
] as const

export type NoteCategory = (typeof NOTE_CATEGORIES)[number]

export interface Note {
  noteId: number
  name: string
  category: NoteCategory
  imageUrl: string | null
}

export interface NoteDetail extends Note {
  description: string
  /** 이 노트가 들어간 향수 수 */
  perfumeCount: number
}
