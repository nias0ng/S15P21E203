import { Badge } from '@/shared/ui/Badge'

import type { PerfumeDetail } from '../types'

type Props = { notes: PerfumeDetail['notes'] }

/** 향수 상세 ② 향조 (와이어프레임 A10 — DTL-02) */
export function PerfumeNotes({ notes }: Props) {
  const rows = [
    ['탑 노트', notes.top],
    ['미들 노트', notes.middle],
    ['베이스 노트', notes.base],
  ] as const

  return (
    <section className="space-y-3 p-6">
      <h2 className="text-ink-muted text-[10.5px]">향조</h2>
      {rows.map(([label, items]) => (
        <div key={label} className="flex items-center gap-4">
          <span className="text-ink w-20 shrink-0 text-xs">{label}</span>
          <div className="flex flex-wrap gap-1.5">
            {items.map((note) => (
              <Badge key={note} tone="outline">
                {note}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
