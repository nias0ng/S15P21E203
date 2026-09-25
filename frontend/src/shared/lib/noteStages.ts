export const NOTE_STAGES = ['TOP', 'MIDDLE', 'BASE'] as const

export const NOTE_FLAT = 'FLAT'

export const NOTE_OTHER = '기타'

const STAGE_ORDER: readonly string[] = [...NOTE_STAGES, NOTE_FLAT]

export type NoteStageGroup<T> = {
  stage: string
  notes: T[]
}

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
