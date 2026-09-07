import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { Brand } from '../types'

type Props = { items: Brand[]; isPending?: boolean }

/**
 * 브랜드 카드 그리드 (와이어프레임 A34 — 5열)
 *
 * 와이어프레임 주석: "브랜드를 누르면 그 브랜드의 향수 목록
 * (A33 향수 페이지에 브랜드 필터가 걸린 상태)". 그래서 브랜드 상세 화면이 아니라
 * 향수 페이지로 브랜드를 쿼리에 실어 보냅니다.
 */
export function BrandGrid({ items, isPending = false }: Props) {
  const gridClass = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="브랜드를 찾지 못했습니다"
        description="브랜드명을 다시 확인해 주세요."
      />
    )
  }

  return (
    <ul className={gridClass}>
      {items.map((brand) => (
        <li key={brand.brandId}>
          <Link
            to={`${ROUTES.PERFUMES}?brand=${encodeURIComponent(brand.name)}`}
            className="border-line bg-surface-card hover:border-slate flex flex-col gap-1.5 border p-2.5 transition-shadow hover:shadow-md"
          >
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt=""
                className="border-line bg-surface-sunken h-24 w-full border object-contain"
              />
            ) : (
              <span className="border-line bg-surface-sunken text-ink-muted flex h-24 w-full items-center justify-center border text-[10.5px]">
                로고
              </span>
            )}
            <span className="text-ink truncate text-xs font-bold">
              {brand.name}
            </span>
            <span className="text-ink-muted text-[10.5px]">
              향수 {brand.perfumeCount}개
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
