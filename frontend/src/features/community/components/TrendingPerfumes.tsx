import { Link } from 'react-router'

import { toPerfumeDetail } from '@/shared/config/routes'

import type { TrendingPerfume } from '../types'

type Props = { items: TrendingPerfume[] }

/**
 * 지금 많이 언급되는 향수 (와이어프레임 A22a · A22b 우측)
 *
 * 와이어프레임 주석: "향수를 누르면 그 향수의 후기만 모아 본다 —
 * 커뮤니티가 향수 데이터에 붙는 지점".
 *
 * "그 향수의 후기만 모아 보는" 별도 화면은 **만들지 않기로 확정**되었습니다.
 * 향수 상세(A10)로 보내고, 상세의 후기 구역이 그 역할을 합니다.
 */
export function TrendingPerfumes({ items }: Props) {
  if (items.length === 0) return null

  return (
    <aside className="border-line space-y-2 border p-4">
      <h2 className="text-ink text-xs font-bold">지금 많이 언급되는 향수</h2>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.perfumeId}>
            <Link
              to={toPerfumeDetail(item.perfumeId)}
              className="hover:bg-line-soft flex items-baseline gap-2 px-1 py-1"
            >
              <span className="text-ink min-w-0 flex-1 truncate text-[11px]">
                {item.name}
              </span>
              <span className="text-ink-muted shrink-0 text-[10.5px]">
                글 {item.postCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}
