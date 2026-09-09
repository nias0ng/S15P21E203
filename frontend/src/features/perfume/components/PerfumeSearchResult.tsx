import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { toPerfumeDetail } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { perfumeListQuery } from '../queries'

type Props = {
  keyword: string
  /** 검색어를 비웁니다. 검색 결과 0건일 때 [초기화] 버튼에 씁니다. */
  onResetKeyword?: () => void
}

/**
 * 향수 검색 결과 목록 (와이어프레임 A09 — COM-05)
 *
 * A33 의 그리드와 달리 한 줄에 하나씩 쌓는 목록형입니다.
 * 와이어프레임에 "검색 결과 128" 처럼 총 건수가 표시됩니다.
 */
export function PerfumeSearchResult({ keyword, onResetKeyword }: Props) {
  const { data, isPending, isError, refetch } = useQuery({
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
      <EmptyState
        title="검색에 실패했습니다"
        description="다시 시도해주세요."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

  if (data.perfumes.length === 0) {
    return (
      <EmptyState
        title="검색 결과가 없습니다"
        description={`'${keyword}' 와 일치하는 향수를 찾지 못했습니다.`}
        action={
          onResetKeyword && (
            <Button variant="outline" onClick={onResetKeyword}>
              초기화
            </Button>
          )
        }
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
        {data.perfumes.map((perfume) => (
          <li key={perfume.perfumeId}>
            <Link
              to={toPerfumeDetail(perfume.perfumeId)}
              className="hover:bg-line-soft flex items-center gap-3 p-3 transition-colors"
            >
              <Thumbnail
                src={perfume.imageUrl}
                fallback="이미지"
                className="size-14 shrink-0"
              />

              <span className="min-w-0 flex-1">
                <span className="text-ink block truncate text-xs font-bold">
                  {perfume.name}
                </span>
                <span className="text-ink-muted block truncate text-[10.5px]">
                  {perfume.brandName}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
