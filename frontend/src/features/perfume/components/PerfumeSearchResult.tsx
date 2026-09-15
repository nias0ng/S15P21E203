import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { toPerfumeDetail } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Pagination } from '@/shared/ui/Pagination'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { perfumeListQuery } from '../queries'

/** 백엔드 기본값과 같습니다. 최대는 100 입니다. */
const PAGE_SIZE = 20

type Props = {
  keyword: string
  /** 0부터 시작합니다 (백엔드와 같습니다) */
  page: number
  onPageChange: (page: number) => void
  /** 검색어를 비웁니다. 검색 결과 0건일 때 [초기화] 버튼에 씁니다. */
  onResetKeyword?: () => void
}

/**
 * 향수 검색 결과 목록 (와이어프레임 A09 — COM-05)
 *
 * A33 의 그리드와 달리 한 줄에 하나씩 쌓는 목록형입니다.
 * 와이어프레임에 "검색 결과 128" 처럼 총 건수가 표시됩니다.
 *
 * **쪽을 넘길 수 있어야 합니다.** 검색은 인기 200개가 아니라 카탈로그 전체를 뒤져서
 * 수백 건이 나옵니다. 예전에는 첫 쪽만 부르면서 "검색 결과 1,284" 라고 적어 놓고
 * 스무 줄만 그렸습니다 — 숫자와 화면이 대놓고 어긋났습니다.
 */
export function PerfumeSearchResult({
  keyword,
  page,
  onPageChange,
  onResetKeyword,
}: Props) {
  const { data, isPending, isError, refetch } = useQuery({
    ...perfumeListQuery({ keyword, page, size: PAGE_SIZE }),
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
      <div className="space-y-2.5">
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

  // 건수로 판단합니다. 줄 수로 보면 범위를 넘은 쪽(주소를 직접 고친 경우)에서도
  // "검색 결과가 없습니다" 가 떠서, 결과가 있는데 없다고 말하게 됩니다.
  if (data.totalElements === 0) {
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
    <div className="space-y-2.5">
      <p className="text-ink-muted text-xs">
        검색 결과{' '}
        <span className="text-ink font-bold">{data.totalElements}</span>
      </p>

      {/* 범위를 넘은 쪽. 앞쪽으로 돌아갈 수 있게 아래 쪽 번호는 그대로 둡니다 */}
      {data.perfumes.length === 0 && (
        <EmptyState
          title="이 쪽에는 결과가 없습니다"
          description="앞쪽으로 돌아가 주세요."
        />
      )}

      {data.perfumes.length > 0 && (
        <ul className="border-line divide-line divide-y border">
          {data.perfumes.map((perfume) => (
            <li key={perfume.perfumeId}>
              <Link
                to={toPerfumeDetail(perfume.perfumeId)}
                className="hover:bg-line-soft flex items-center gap-2.5 p-2.5 transition-colors"
              >
                <Thumbnail
                  src={perfume.imageUrl}
                  fallback="이미지"
                  className="size-13.75 shrink-0"
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
      )}

      <Pagination
        label="검색 결과 페이지"
        page={page}
        size={PAGE_SIZE}
        totalElements={data.totalElements}
        onPageChange={onPageChange}
      />
    </div>
  )
}
