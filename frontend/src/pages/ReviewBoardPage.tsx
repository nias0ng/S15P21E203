import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import {
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
import { cn } from '@/shared/lib/cn'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { AuthLinkButton } from '@/shared/ui/AuthLinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { PillFilter } from '@/shared/ui/PillFilter'

/** 백엔드 기본값과 같습니다 */
const PAGE_SIZE = 10

/**
 * 후기 게시판 (와이어프레임 A22a — CMT-01)
 *
 * 정렬과 쪽 번호를 URL 쿼리에 둡니다. 새로고침 · 뒤로가기 · 링크 공유가 같은
 * 결과를 보여주게 하려는 것입니다. **URL 의 page 는 1부터**이고 백엔드는 0부터라
 * 여기서 한 번 바꿉니다 — 주소창에 `page=0` 이 보이면 사람이 읽기 어렵습니다.
 *
 * 줄을 누르면 후기 상세(A12)로 갑니다. 향수 상세에서 후기를 눌렀을 때와 같은
 * 화면입니다 — 게시판용 상세를 따로 두면 같은 후기가 두 주소를 갖게 됩니다.
 *
 * 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md */
export default function ReviewBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = (searchParams.get('sort') as ReviewSort | null) ?? 'RECENT'
  const page = Math.max(0, Number(searchParams.get('page') ?? 1) - 1)

  const reviews = useQuery(reviewBoardQuery({ sort, page, size: PAGE_SIZE }))
  const trending = useQuery(trendingPerfumesQuery())

  /*
    곁판을 그릴지. 언급된 향수가 하나도 없으면 `TrendingPerfumes` 가 아무것도
    그리지 않으므로 칸도 같이 접습니다(아래 grid 주석).
  */
  const showTrending =
    trending.isPending || (trending.data?.perfumes.length ?? 0) > 0

  const queryClient = useQueryClient()
  const isLoggedIn = useIsLoggedIn()
  const [loginOpen, setLoginOpen] = useState(false)
  const boardKey = communityKeys.reviewBoard({ sort, page, size: PAGE_SIZE })

  /**
   * 좋아요 토글 (CMT-05).
   *
   * 응답에 `liked` 와 `likeCount` 가 함께 오므로 화면이 숫자를 직접 더하고 빼지
   * 않습니다 — 그 사이 다른 사람이 누른 것도 같이 반영됩니다. 그래서 무효화 대신
   * **응답 값을 그 줄에만 덮어씁니다.** 목록 전체를 다시 부르면 보고 있던 자리가
   * 흔들리고, 정렬이 '좋아요순'이면 방금 누른 줄이 눈앞에서 이동합니다.
   *
   * 서버가 멱등이라(이미 누른 것에 또 눌러도 같은 결과) 따닥 누름을 막지 않습니다.
   */
  const toggleLike = useMutation({
    mutationFn: ({ id, liked }: { id: number; liked: boolean }) =>
      liked ? unlikeReview(id) : likeReview(id),
    onSuccess: (result) => {
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
    const params = new URLSearchParams(searchParams)
    if (next.sort !== undefined) {
      params.set('sort', next.sort)
      // 정렬을 바꾸면 첫 쪽부터 다시 봅니다 — 3쪽에 있던 자리는 의미가 없습니다
      params.delete('page')
    }
    if (next.page !== undefined) params.set('page', String(next.page + 1))
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

      {/*
        곁판이 없으면 **한 칸으로 폅니다.** 두 칸으로 고정해 두면 언급된 향수가 없는
        동안 오른쪽 255px 이 빈 채로 남아, 유리판이 화면 오른쪽 끝에 못 닿고 잘린
        것처럼 보입니다. 불러오는 중에는 칸을 비워 둡니다 — 대개는 값이 오므로,
        먼저 폈다가 좁히면 목록 전체가 한 번 출렁입니다.
      */}
      <div
        className={cn(
          'grid gap-6.25',
          showTrending && 'lg:grid-cols-[1fr_255px]',
        )}
      >
        <div className="min-w-0 space-y-3.75">
          {/*
            후기 게시판에는 분류 필터가 없습니다 — 전부 후기라서.

            정렬은 **늘 하나가 켜져 있어야** 해서 `required` 입니다. 꺼지면 줄 세울
            기준이 없어집니다 — 브랜드 목록(A34)의 정렬 알약과 같은 규칙입니다.
            가운데로 세우는 것도 저 화면들과 같습니다(머리말도 가운데입니다).
          */}
          <PillFilter
            label="정렬"
            options={REVIEW_SORTS}
            value={sort}
            onChange={(next) => updateParams({ sort: next ?? 'RECENT' })}
            required
            className="flex-wrap justify-center"
          />

          <section className={GLASS_PANEL}>
            <div className="mb-6.25 flex items-baseline gap-2.5">
              {/* 판 위 제목은 향수 · 브랜드 · 노트의 판과 같은 크기입니다 */}
              <h2 className="text-ink font-serif text-2xl">전체 후기</h2>
              {!reviews.isPending && !!reviews.data?.totalElements && (
                <span className="text-ink-muted text-caption">
                  {reviews.data.totalElements.toLocaleString()}개
                </span>
              )}
            </div>

            <PostList
              items={(reviews.data?.reviews ?? []).map(reviewToBoardItem)}
              isPending={reviews.isPending}
              onToggleLike={(item) => {
                // 비로그인은 401 이라, 보내 보는 대신 먼저 안내합니다
                if (!isLoggedIn) {
                  setLoginOpen(true)
                  return
                }
                toggleLike.mutate({ id: item.id, liked: item.liked })
              }}
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
        </div>

        <TrendingPerfumes
          items={trending.data?.perfumes ?? []}
          days={trending.data?.days}
        />
      </div>

      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={ROUTES.COMMUNITY_REVIEWS}
        description="좋아요는 로그인한 뒤에 누를 수 있습니다. 글은 로그인 없이도 읽을 수 있습니다."
      />
    </div>
  )
}
