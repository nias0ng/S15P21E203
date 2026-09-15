import { Badge } from '@/shared/ui/Badge'

import type { PerfumeNote } from '../types'

type Props = {
  notes: PerfumeNote[]
  isPending?: boolean
}

/**
 * 와이어프레임이 기대하는 세 구역과 그 순서입니다.
 * 응답의 `noteType` 은 값 제약이 없어 여기 없는 값도 올 수 있습니다.
 */
const KNOWN_TYPES: Record<string, string> = {
  TOP: '탑 노트',
  MIDDLE: '미들 노트',
  BASE: '베이스 노트',
}

const KNOWN_ORDER = Object.keys(KNOWN_TYPES)

/**
 * 향수 상세 ② 향조 (와이어프레임 A10 — DTL-02)
 *
 * **묶는 일을 화면이 합니다.** 백엔드는 `noteType` 을 해석하지 않고 문자열 그대로
 * 내려줍니다(컬럼에 값 제약이 없어, 서버가 세 칸에 나눠 담으면 예상 못 한 값이 조용히
 * 버려집니다). 그래서 모르는 구역이 와도 버리지 않고 제 이름으로 한 줄 만듭니다.
 *
 * 어코드(`accords`)도 같은 응답에 있지만 와이어프레임에 자리가 없어 아직 안 그립니다.
 */
export function PerfumeNotes({ notes, isPending = false }: Props) {
  const rows = groupByType(notes)

  return (
    <section className="space-y-2.5 p-6.25">
      <h2 className="text-ink-muted text-[10.5px]">향조</h2>

      {isPending ? (
        <p className="text-ink-muted text-xs">향조를 불러오는 중입니다.</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-muted text-xs">
          향조 정보가 아직 등록되지 않았습니다.
        </p>
      ) : (
        rows.map(([label, items]) => (
          <div key={label} className="flex items-center gap-3.75">
            <span className="text-ink w-20 shrink-0 text-xs">{label}</span>
            <div className="flex flex-wrap gap-1.25">
              {items.map((note) => (
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
 * 노트를 구역별로 묶습니다. 탑 · 미들 · 베이스를 먼저 놓고, 모르는 구역은 처음 나온
 * 순서대로 뒤에 붙입니다. 비어 있는 구역은 줄을 만들지 않습니다 — 셋 중 하나만 있는
 * 향수가 많아 빈 줄을 그리면 화면 절반이 대시가 됩니다.
 */
function groupByType(notes: PerfumeNote[]): [string, PerfumeNote[]][] {
  const groups = new Map<string, PerfumeNote[]>()

  for (const note of notes) {
    const type = note.noteType?.trim().toUpperCase() || '기타'
    const group = groups.get(type)
    if (group) group.push(note)
    else groups.set(type, [note])
  }

  const known = KNOWN_ORDER.filter((type) => groups.has(type))
  const rest = [...groups.keys()].filter((type) => !KNOWN_ORDER.includes(type))

  return [...known, ...rest].map((type) => [
    KNOWN_TYPES[type] ?? type,
    groups.get(type) ?? [],
  ])
}
