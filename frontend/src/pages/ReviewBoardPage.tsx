import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  boardTitle,
  BoardHeader,
  communityKeys,
  PostList,
  REVIEW_SORTS,
  reviewBoardQuery,
  reviewToBoardItem,
  TrendingPerfumes,
  trendingPerfumesQuery,
  type ReviewSort,
} from '@/features/community'
// 좋아요는 후기 자원(`/reviews/{id}/like`)이라 향수 도메인에 있습니다.
// 두 도메인은 서로 import 할 수 없으므로 화면에서 조합합니다.
import { likeReview, reviewKeys, unlikeReview } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { useLikeToggle } from '@/shared/hooks/useLikeToggle'
import { cn } from '@/shared/lib/cn'
import { readPage, withQueryParams, writePage } from '@/shared/lib/queryParams'
import { AuthLinkButton } from '@/shared/ui/AuthLinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { PillFilter } from '@/shared/ui/PillFilter'

/** 백엔드 기본값과 같습니다 */
const PAGE_SIZE = 10

/**
 * 후기 게시판 (A22a — CMT-01)
 *
 * **URL 의 page 는 1부터**이고 백엔드는 0부터라 여기서 한 번 바꿉니다.
 * 줄을 누르면 후기 상세(A12)로 갑니다 — 향수 상세에서 눌렀을 때와 같은 화면입니다
 * (게시판용을 따로 두면 같은 후기가 두 주소를 갖습니다).
 *
 * 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md */
export default function ReviewBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = (searchParams.get('sort') as ReviewSort | null) ?? 'RECENT'
  const page = readPage(searchParams)

  const reviews = useQuery(reviewBoardQuery({ sort, page, size: PAGE_SIZE }))
  const trending = useQuery(trendingPerfumesQuery())

  /*
   * 메인에서 잠수로 들어왔으면 커튼이 짙은 바다색으로 덮은 채 이 신호를 기다립니다
   * (안 알려도 상한에 걷힙니다 — `shared/ui/DiveCurtain`). 잠수로 들어온 것이 아니면
   * 아무 일도 안 일어납니다.
   *
   * 기준은 **목록**입니다 — 아래에서 스피너가 갈리는 바로 그 조건입니다. 목록이 칠해지면
   * 이 화면은 다 선 것이고, 여기는 진열대처럼 뒤늦게 떠오르는 사진 벽이 없습니다.
   *
   * ⚠ 곁판(`trending`)은 안 기다립니다 — 본문이 아니라 옆에 붙는 칸이고, 늦게 와도 목록이
   *   밀리지 않습니다. 기다리면 곁판 하나에 커튼이 상한까지 서 있게 됩니다.
   */
  useDiveReady(!reviews.isPending)

  /* 언급된 향수가 없으면 `TrendingPerfumes` 가 비어서 칸도 같이 접습니다 */
  const showTrending =
    trending.isPending || (trending.data?.perfumes.length ?? 0) > 0

  const queryClient = useQueryClient()
  const boardKey = communityKeys.reviewBoard({ sort, page, size: PAGE_SIZE })

  /**
   * 좋아요 토글 (CMT-05). 비로그인 안내 · 누르기/취소 고르기는 `useLikeToggle` 이
   * 맡고, 여기서는 캐시만 고칩니다 — 응답 값을 **그 줄에만 덮어씁니다.** 목록 전체를
   * 다시 부르면 정렬이 '좋아요순'일 때 방금 누른 줄이 눈앞에서 이동합니다.
   */
  const likeToggle = useLikeToggle({
    like: likeReview,
    unlike: unlikeReview,
    onToggled: (result) => {
      queryClient.setQueryData(boardKey, (old: typeof reviews.data) =>
        old === undefined
          ? old
          : {
              ...old,
              reviews: old.reviews.map((review) =>
                review.reviewId === result.reviewId
                  ? {
                      ...review,
                      liked: result.liked,
                      likeCount: result.likeCount,
                    }
                  : review,
              ),
            },
      )
      // 후기 상세는 숫자를 읽기만 하므로, 다음에 열 때 맞는 값이 보이게 비웁니다
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })

  const updateParams = (next: { sort?: ReviewSort; page?: number }) => {
    let params = searchParams
    if (next.sort !== undefined) {
      // 정렬을 바꾸면 첫 쪽부터 다시 봅니다 — 3쪽에 있던 자리는 의미가 없습니다
      params = writePage(withQueryParams(params, { sort: next.sort }), 0)
    }
    if (next.page !== undefined) params = writePage(params, next.page)
    setSearchParams(params)
  }

  return (
    <div className="space-y-7.5">
      <BoardHeader
        description="향수 한 개에 대한 시향 기록입니다. 점수나 별점 없이 좋아요만 있습니다."
        action={
          <AuthLinkButton
            to={ROUTES.REVIEW_WRITE}
            size="sm"
            description="후기는 로그인한 뒤에 쓸 수 있습니다."
          >
            후기 쓰기
          </AuthLinkButton>
        }
      />

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
        {/* 분류 필터는 없습니다(전부 후기). 정렬은 꺼지면 기준이 없어 `required` */}
        <PillFilter
          label="정렬"
          options={REVIEW_SORTS}
          value={sort}
          onChange={(next) => updateParams({ sort: next ?? 'RECENT' })}
          required
          className="flex-wrap justify-center lg:col-span-2 lg:col-start-1 lg:row-start-1"
        />

        <section
          className={cn(GLASS_PANEL, 'min-w-0 lg:col-start-1 lg:row-start-2')}
        >
          <div className="mb-6.25 flex items-baseline gap-2.5">
            {/* 판 위 제목은 향수 · 브랜드 · 노트의 판과 같은 크기입니다 */}
            <h2 className="text-ink font-serif text-2xl">
              {boardTitle(sort, '후기')}
            </h2>
            {!reviews.isPending && !!reviews.data?.totalElements && (
              <span className="text-ink-muted text-caption">
                {reviews.data.totalElements.toLocaleString()}개
              </span>
            )}
          </div>

          <PostList
            items={(reviews.data?.reviews ?? []).map(reviewToBoardItem)}
            isPending={reviews.isPending}
            onToggleLike={(item) =>
              likeToggle.toggle({ id: item.id, liked: item.liked })
            }
            emptyAction={
              <AuthLinkButton
                to={ROUTES.REVIEW_WRITE}
                size="sm"
                description="후기는 로그인한 뒤에 쓸 수 있습니다."
              >
                후기 쓰기
              </AuthLinkButton>
            }
          />

          <Pagination
            className="mt-6.25"
            label="후기 게시판 페이지"
            page={page}
            size={PAGE_SIZE}
            totalElements={reviews.data?.totalElements ?? 0}
            onPageChange={(next) => updateParams({ page: next })}
          />
        </section>

        <TrendingPerfumes
          className="lg:col-start-2 lg:row-start-2"
          items={trending.data?.perfumes ?? []}
          days={trending.data?.days}
        />
      </div>

      <LoginRequiredDialog
        open={likeToggle.loginRequired}
        onClose={likeToggle.closeLoginRequired}
        redirectTo={ROUTES.COMMUNITY_REVIEWS}
        description="좋아요는 로그인한 뒤에 누를 수 있습니다. 글은 로그인 없이도 읽을 수 있습니다."
      />
    </div>
  )
}
