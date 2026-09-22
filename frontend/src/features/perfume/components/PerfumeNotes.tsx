import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/Badge'
import { GLASS_PANEL } from '@/shared/ui/panel'

import type { PerfumeNote } from '../types'

type Props = {
  notes: PerfumeNote[]
  isPending?: boolean
  className?: string
}

/** 적는 순서가 곧 화면에 그리는 순서입니다 */
const STAGE_LABELS: Record<string, string> = {
  TOP: 'Top',
  MIDDLE: 'Middle',
  BASE: 'Base',
}

/** 원본에 피라미드가 없는 향수(27%). 단계가 아니라 "나눌 수 없음" 이라 라벨 없이 한 줄입니다 */
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
 * 향수 상세 ② 향조. **쪼개고 묶는 일을 화면이 합니다** — 백엔드가 `noteType` 을
 * 해석하지 않아, 모르는 값도 버리지 않고 제 이름으로 한 줄 만듭니다.
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

/** Top · Middle · Base → flat → 모르는 단계 순으로 묶습니다 */
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
 * `top+middle` 은 **두 단계 모두**라 쪼개서 양쪽에 넣습니다 — 한 덩어리로 두면
 * `TOP+MIDDLE` 이라는 없는 단계가 생깁니다.
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
