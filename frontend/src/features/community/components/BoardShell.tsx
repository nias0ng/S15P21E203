import { useQuery } from '@tanstack/react-query'

import { cn } from '@/shared/lib/cn'
import { AuthLinkButton } from '@/shared/ui/AuthLinkButton'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'

import { trendingPerfumesQuery } from '../queries'
import type { BoardItem } from '../types'

import { BoardHeader } from './BoardHeader'
import { PostList } from './PostList'
import { TrendingPerfumes } from './TrendingPerfumes'

type Props = {
  /** 글쓰기 단추. 머리말 오른쪽과 빈 목록 안내에 같은 단추가 섭니다 */
  write: { to: string; label: string; description: string }
  /** 윗줄에 혼자 서는 거르기 알약 */
  filters: React.ReactNode
  /** 판 제목 (`boardTitle`) */
  title: string
  items: BoardItem[]
  isPending: boolean
  /** 목록 전체 개수. 제목 옆에 적고 쪽 수를 셉니다 */
  totalElements: number | undefined
  onToggleLike: (item: BoardItem) => void
  /** 0부터 셉니다 */
  page: number
  size: number
  onPageChange: (page: number) => void
  /** 쪽 넘김의 이름. 낭독기가 읽습니다 */
  paginationLabel: string
  /** 화면이 띄우는 모달. 틀의 맨 끝에 둡니다 */
  children?: React.ReactNode
}

/**
 * 게시판 틀 (A22a · A22b 공용). 머리말 · 거르기 · 유리판의 목록과 쪽 넘김 · 곁판을
 * 한 벌로 둡니다. 목록을 부르고 좋아요로 캐시를 고치는 일은 화면이 맡습니다 — 후기의
 * 좋아요는 향수 도메인에 있어 이 도메인이 부를 수 없습니다.
 *
 * 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md
 */
export function BoardShell({
  write,
  filters,
  title,
  items,
  isPending,
  totalElements,
  onToggleLike,
  page,
  size,
  onPageChange,
  paginationLabel,
  children,
}: Props) {
  const trending = useQuery(trendingPerfumesQuery())

  /* 언급된 향수가 없으면 `TrendingPerfumes` 가 비어서 칸도 같이 접습니다 */
  const showTrending =
    trending.isPending || (trending.data?.perfumes.length ?? 0) > 0

  const writeButton = (
    <AuthLinkButton to={write.to} size="sm" description={write.description}>
      {write.label}
    </AuthLinkButton>
  )

  return (
    <div className="space-y-7.5">
      <BoardHeader action={writeButton} />

      {/* 곁판이 없으면 한 칸으로 폅니다. 불러오는 중에는 칸을 비워 둡니다 */}
      <div
        className={cn(
          /*
            알약은 윗줄에 혼자 서고, 유리판과 곁판이 아랫줄에서 나란히 섭니다 —
            한 칸 안에 알약을 넣으면 곁판만 그 높이만큼 위에서 시작합니다.
          */
          'grid gap-x-6.25 gap-y-3.75',
          /* 곁판 255px. 임의값 px 는 `--spacing` 을 안 타서 좁은 화면에서 곁판만 안 줄어듭니다 */
          showTrending && 'lg:grid-cols-[1fr_calc(var(--spacing)*63.75)]',
        )}
      >
        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1">
          {filters}
        </div>

        <section
          className={cn(GLASS_PANEL, 'min-w-0 lg:col-start-1 lg:row-start-2')}
        >
          <div className="mb-6.25 flex items-baseline gap-2.5">
            {/* 판 위 제목은 향수 · 브랜드 · 노트의 판과 같은 크기입니다 */}
            <h2 className="text-ink font-serif text-2xl">{title}</h2>
            {!isPending && !!totalElements && (
              <span className="text-ink-muted text-caption">
                {totalElements.toLocaleString()}개
              </span>
            )}
          </div>

          <PostList
            items={items}
            isPending={isPending}
            onToggleLike={onToggleLike}
            emptyAction={writeButton}
          />

          <Pagination
            className="mt-6.25"
            label={paginationLabel}
            page={page}
            size={size}
            totalElements={totalElements ?? 0}
            onPageChange={onPageChange}
          />
        </section>

        <TrendingPerfumes
          className="lg:col-start-2 lg:row-start-2"
          data={trending.data}
        />
      </div>

      {children}
    </div>
  )
}
