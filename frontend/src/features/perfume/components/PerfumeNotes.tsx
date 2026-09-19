import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/Badge'
import { GLASS_PANEL } from '@/shared/ui/panel'

import type { PerfumeNote } from '../types'

type Props = {
  notes: PerfumeNote[]
  isPending?: boolean
  /** 놓이는 자리는 화면이 정합니다 — 개요 오른쪽에서 남은 높이를 받습니다(`flex-1`) */
  className?: string
}

/** 향조 피라미드의 세 단계와 그 순서입니다 */
const STAGE_LABELS: Record<string, string> = {
  TOP: 'Top',
  MIDDLE: 'Middle',
  BASE: 'Base',
}

/**
 * 원본에 피라미드가 **아예 없는** 향수(전체의 27%). 네 번째 단계가 아니라
 * "나눌 수 없음" 이라 라벨 없이 한 줄로 늘어놓습니다.
 */
const FLAT = 'FLAT'

/** `noteType` 이 비어 온 노트가 모이는 줄 */
const OTHER = '기타'

const ROW_ORDER = [...Object.keys(STAGE_LABELS), FLAT]

type NoteRow = {
  stage: string
  /** `null` 이면 라벨 칸 없이 노트만 그립니다 (flat) */
  label: string | null
  notes: PerfumeNote[]
}

/**
 * 향수 상세 ② 향조 (와이어프레임 A10 — DTL-02)
 *
 * **쪼개고 묶는 일을 화면이 합니다.** 백엔드는 `noteType` 을 해석하지 않고 문자열
 * 그대로 내려줍니다(컬럼에 값 제약이 없어, 서버가 세 칸에 나눠 담으면 예상 못 한
 * 값이 조용히 버려집니다). 시드가 넣는 값은 `top` · `middle` · `base` · `flat` 과
 * 셋의 조합(`top+middle` 등)입니다 — `backend/db/seed/load_perfume_notes.sql` 이
 * 이 여덟 가지만 통과시킵니다. 그래도 모르는 값이 오면 버리지 않고 제 이름으로
 * 한 줄 만듭니다.
 *
 * 어코드(`accords`)도 같은 응답에 있지만 와이어프레임에 자리가 없어 아직 안 그립니다.
 */
export function PerfumeNotes({ notes, isPending = false, className }: Props) {
  const rows = toRows(notes)

  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75', className)}>
      <h2 className="text-ink text-title font-serif font-semibold">향조</h2>

      {isPending ? (
        <p className="text-ink-muted text-body">향조를 불러오는 중입니다.</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-muted text-body">
          향조 정보가 아직 등록되지 않았습니다.
        </p>
      ) : (
        rows.map((row) => (
          <div key={row.stage} className="flex items-center gap-3.75">
            {row.label !== null && (
              <span className="text-ink text-body w-20 shrink-0">
                {row.label}
              </span>
            )}
            <div className="flex flex-wrap gap-1.25">
              {row.notes.map((note) => (
                <Badge key={note.noteId} tone="outline">
                  {note.name}
                </Badge>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  )
}

/**
 * 노트를 단계별로 묶습니다. Top · Middle · Base → flat → 모르는 단계 순이고,
 * 비어 있는 단계는 줄을 만들지 않습니다(셋 중 하나만 있는 향수가 많습니다).
 */
function toRows(notes: PerfumeNote[]): NoteRow[] {
  const groups = new Map<string, PerfumeNote[]>()

  for (const note of notes) {
    for (const stage of stagesOf(note)) {
      const group = groups.get(stage)
      if (group) group.push(note)
      else groups.set(stage, [note])
    }
  }

  const known = ROW_ORDER.filter((stage) => groups.has(stage))
  const rest = [...groups.keys()].filter((stage) => !ROW_ORDER.includes(stage))

  return [...known, ...rest].map((stage) => ({
    stage,
    label: stage === FLAT ? null : (STAGE_LABELS[stage] ?? stage),
    notes: groups.get(stage) ?? [],
  }))
}

/**
 * 노트가 속하는 단계들. `top+middle` 은 **두 단계 모두**라 쪼개서 양쪽에 넣습니다 —
 * 한 덩어리로 두면 `TOP+MIDDLE` 이라는 없는 단계가 생깁니다.
 */
function stagesOf(note: PerfumeNote): string[] {
  const raw = note.noteType?.trim().toUpperCase()
  if (!raw) return [OTHER]

  const stages = raw
    .split('+')
    .map((stage) => stage.trim())
    .filter(Boolean)

  return stages.length > 0 ? stages : [OTHER]
}
