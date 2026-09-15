import { useState } from 'react'
import { Link } from 'react-router'

import { toPerfumeDetail } from '@/shared/config/routes'

import { SCENT_REGIONS, type VoyageLogEntry } from '../types'

type Props = { entries: VoyageLogEntry[] }

/**
 * 향해 일지 (와이어프레임 A01 · A02 · A03 — MAP-24)
 *
 * 와이어프레임 주석:
 * - 취향 변화가 아니라 배가 지나온 자리를 적는다 — 다른 향 구역으로 들어갈 때마다
 *   '○○ 구역 진입' 한 줄이 쌓인다
 * - 진입 줄을 누르면 그 구역에서 조회했던 향수가 펼쳐진다 (폴더블)
 * - 일지 전체도 접힌다
 * - 지도 위에 계속 떠 있다 — 포인트를 열면 해당 구역 줄에 향수가 한 줄 쌓인다
 */
export function VoyageLog({ entries }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  // 가장 최근 진입만 펼쳐둡니다
  const [openIds, setOpenIds] = useState<number[]>(
    entries[0] ? [entries[0].entryId] : [],
  )

  const toggle = (entryId: number) => {
    setOpenIds((prev) =>
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId],
    )
  }

  return (
    <section className="border-line bg-surface-card/95 w-56.25 border p-2.5 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <h2 className="text-ink text-[11px] font-bold">향해 일지</h2>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="text-ink-muted hover:text-ink ml-auto text-[10.5px]"
        >
          {collapsed ? '펼치기' : '접기'} <span aria-hidden>▾</span>
        </button>
      </div>

      {!collapsed && (
        <ul className="mt-2.5 space-y-1.25">
          {entries.map((entry) => {
            const open = openIds.includes(entry.entryId)
            const regionLabel = SCENT_REGIONS.find(
              (region) => region.id === entry.region,
            )?.label

            return (
              <li key={entry.entryId}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(entry.entryId)}
                  className="hover:bg-line-soft flex w-full items-center gap-1.25 px-1.25 py-1.25 text-left"
                >
                  <span aria-hidden className="text-ink-muted text-[10px]">
                    {open ? '▾' : '▸'}
                  </span>
                  <span className="text-ink-muted text-[10px]">
                    {entry.enteredAt.slice(5, 10).replace('-', '.')}
                  </span>
                  <span className="text-ink text-[10.5px]">
                    {regionLabel} 구역 진입
                  </span>
                </button>

                {open && entry.visited.length > 0 && (
                  <ul className="mt-0.5 ml-5 space-y-0.5">
                    {entry.visited.map((perfume) => (
                      <li key={perfume.perfumeId}>
                        <Link
                          to={toPerfumeDetail(perfume.perfumeId)}
                          className="text-ink-muted hover:text-ink block truncate text-[10px]"
                        >
                          {perfume.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
