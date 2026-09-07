import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { toPerfumeDetail } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'

import { perfumeListQuery } from '../queries'

type Props = { keyword: string }

/**
 * 향수 검색 결과 목록 (와이어프레임 A09 — COM-05)
 *
 * A33 의 그리드와 달리 한 줄에 하나씩 쌓는 목록형입니다.
 * 와이어프레임에 "검색 결과 128" 처럼 총 건수가 표시됩니다.
 */
export function PerfumeSearchResult({ keyword }: Props) {
  const { data, isPending, isError, error } = useQuery({
    ...perfumeListQuery({ keyword }),
    // 검색어가 없으면 요청하지 않습니다
    enabled: keyword.trim().length > 0,
  })

  if (!keyword.trim()) {
    return (
      <EmptyState
        title="검색어를 입력해주세요"
        description="향수명 또는 브랜드명으로 검색합니다."
      />
    )
  }

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState title="검색에 실패했습니다" description={error.message} />
    )
  }

  if (data.content.length === 0) {
    return (
      <EmptyState
        title="검색 결과가 없습니다"
        description={`'${keyword}' 와 일치하는 향수를 찾지 못했습니다.`}
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-ink-muted text-xs">
        검색 결과{' '}
        <span className="text-ink font-bold">{data.totalElements}</span>
      </p>

      <ul className="border-line divide-line divide-y border">
        {data.content.map((perfume) => (
          <li key={perfume.perfumeId}>
            <Link
              to={toPerfumeDetail(perfume.perfumeId)}
              className="hover:bg-line-soft flex items-center gap-3 p-3 transition-colors"
            >
              {/* ⚠️ thumbnailUrl 은 백엔드가 아직 안 내려줍니다 */}
              {perfume.thumbnailUrl ? (
                <img
                  src={perfume.thumbnailUrl}
                  alt=""
                  className="border-line bg-surface-sunken size-14 shrink-0 border object-cover"
                />
              ) : (
                <span className="border-line bg-surface-sunken text-ink-muted flex size-14 shrink-0 items-center justify-center border text-[10.5px]">
                  이미지
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="text-ink block truncate text-xs font-bold">
                  {perfume.name}
                </span>
                <span className="text-ink-muted block truncate text-[10.5px]">
                  {perfume.brand}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
