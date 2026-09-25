import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  boardTitle,
  BoardShell,
  communityKeys,
  FREE_SORTS,
  likePost,
  POST_CATEGORIES,
  postListQuery,
  postToBoardItem,
  unlikePost,
  type PostCategory,
  type PostSort,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { useLikeToggle } from '@/shared/hooks/useLikeToggle'
import {
  readOption,
  readPage,
  withQueryParams,
  writePage,
} from '@/shared/lib/queryParams'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PillFilter } from '@/shared/ui/PillFilter'

type CategoryFilter = PostCategory | 'ALL'

const PAGE_SIZE = 20

export default function FreeBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = readOption(searchParams.get('sort'), FREE_SORTS) ?? 'RECENT'
  const category: CategoryFilter =
    readOption(searchParams.get('category'), POST_CATEGORIES) ?? 'ALL'
  const page = readPage(searchParams)

  const listParams = {
    category: category === 'ALL' ? undefined : category,
    sort,
    page,
    size: PAGE_SIZE,
  }

  const posts = useQuery(postListQuery(listParams))

  useDiveReady(!posts.isPending)

  const categoryLabel =
    category === 'ALL'
      ? undefined
      : POST_CATEGORIES.find((entry) => entry.value === category)?.label

  const queryClient = useQueryClient()

  const likeToggle = useLikeToggle({
    like: likePost,
    unlike: unlikePost,
    onToggled: (result) => {
      queryClient.setQueryData(
        communityKeys.posts(listParams),
        (old: typeof posts.data) =>
          old === undefined
            ? old
            : {
                ...old,
                posts: old.posts.map((post) =>
                  post.postId === result.postId
                    ? {
                        ...post,
                        liked: result.liked,
                        likeCount: result.likeCount,
                      }
                    : post,
                ),
              },
      )
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
    },
  })

  const updateParams = (next: {
    sort?: PostSort
    category?: CategoryFilter
    page?: number
  }) => {
    let params = withQueryParams(searchParams, {
      ...(next.sort !== undefined && { sort: next.sort }),
      ...(next.category !== undefined && {
        category: next.category === 'ALL' ? null : next.category,
      }),
    })
    if (next.sort !== undefined || next.category !== undefined) {
      params = writePage(params, 0)
    }
    if (next.page !== undefined) params = writePage(params, next.page)
    setSearchParams(params)
  }

  return (
    <BoardShell
      write={{
        to: ROUTES.POST_WRITE,
        label: '글쓰기',
        description: '글은 로그인한 뒤에 쓸 수 있습니다.',
      }}
      filters={
        <div
          role="group"
          aria-label="글 거르기"
          className="flex flex-col gap-2.5"
        >
          <PillFilter
            label="정렬"
            options={FREE_SORTS}
            value={sort}
            onChange={(next) => updateParams({ sort: next ?? 'RECENT' })}
            required
            className="flex-wrap justify-center"
          />
          <PillFilter
            label="분류"
            options={POST_CATEGORIES}
            value={category === 'ALL' ? null : category}
            onChange={(next) => updateParams({ category: next ?? 'ALL' })}
            className="flex-wrap justify-center"
          />
        </div>
      }
      title={boardTitle(sort, '글', categoryLabel)}
      items={(posts.data?.posts ?? []).map(postToBoardItem)}
      isPending={posts.isPending}
      totalElements={posts.data?.totalElements}
      onToggleLike={(item) =>
        likeToggle.toggle({ id: item.id, liked: item.liked })
      }
      page={page}
      size={PAGE_SIZE}
      onPageChange={(next) => updateParams({ page: next })}
      paginationLabel="자유 게시판 페이지"
    >
      <LoginRequiredDialog
        open={likeToggle.loginRequired}
        onClose={likeToggle.closeLoginRequired}
        redirectTo={ROUTES.COMMUNITY_FREE}
        description="좋아요는 로그인한 뒤에 누를 수 있습니다. 글은 로그인 없이도 읽을 수 있습니다."
      />
    </BoardShell>
  )
}
