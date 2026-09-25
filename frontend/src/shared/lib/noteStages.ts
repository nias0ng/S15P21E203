/** 피라미드의 세 단계. 적는 순서가 곧 화면에 그리는 순서입니다 */
export const NOTE_STAGES = ['TOP', 'MIDDLE', 'BASE'] as const

/** 원본에 피라미드가 없는 향수. 단계가 아니라 "나눌 수 없음" 이라 이름표 없이 한 줄로 그립니다 */
export const NOTE_FLAT = 'FLAT'

/** `noteType` 이 비어 온 노트가 모이는 줄 */
export const NOTE_OTHER = '기타'

const STAGE_ORDER: readonly string[] = [...NOTE_STAGES, NOTE_FLAT]

/** 단계 하나와 그 단계에 든 노트 */
export type NoteStageGroup<T> = {
  /** TOP · MIDDLE · BASE · FLAT · 모르는 값(대문자) · 기타 */
  stage: string
  notes: T[]
}

/**
 * 향조를 단계별로 묶습니다.
 *
 * `noteType` 은 값 제약이 없어 소문자 `top`, 두 단계에 걸친 `top+middle`, 피라미드가 없는
 * `flat`, 빈 값이 섞여 옵니다. 백엔드가 해석하지 않아 묶는 일은 화면이 하고, 모르는 값도
 * 버리지 않고 제 이름으로 한 줄 만듭니다. 줄 머리의 이름표는 화면마다 달라 부르는 쪽이 붙입니다.
 *
 * `top+middle` 은 두 단계 모두에 넣습니다 — 한 덩어리로 두면 `TOP+MIDDLE` 이라는 없는
 * 단계가 생깁니다.
 *
 * @param notes 받은 순서 그대로의 노트
 * @returns TOP · MIDDLE · BASE → FLAT → 그 밖의 단계와 기타(처음 나온 순서) 순의 줄. 노트가
 *   없는 단계는 줄을 만들지 않습니다
 */
export function groupNoteStages<T extends { noteType: string | null }>(
  notes: readonly T[],
): NoteStageGroup<T>[] {
  const groups = new Map<string, T[]>()
  for (const note of notes) {
    for (const stage of stagesOf(note.noteType)) {
      const group = groups.get(stage)
      if (group) group.push(note)
      else groups.set(stage, [note])
    }
  }

  const known = STAGE_ORDER.filter((stage) => groups.has(stage))
  const rest = [...groups.keys()].filter(
    (stage) => !STAGE_ORDER.includes(stage),
  )
  return [...known, ...rest].map((stage) => ({
    stage,
    notes: groups.get(stage) ?? [],
  }))
}

function stagesOf(noteType: string | null): string[] {
  const stages =
    noteType
      ?.trim()
      .toUpperCase()
      .split('+')
      .map((stage) => stage.trim())
      .filter(Boolean) ?? []
  return stages.length > 0 ? stages : [NOTE_OTHER]
}
