import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('community')
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
    category === 'ALL' ? undefined : t(`board.categoryInTitle.${category}`)

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
        label: t('freeBoard.write'),
        description: t('freeBoard.writeLoginRequired'),
      }}
      filters={
        <div
          role="group"
          aria-label={t('freeBoard.filtersLabel')}
          className="flex flex-col gap-2.5"
        >
          <PillFilter
            label={t('board.sortLabel')}
            options={FREE_SORTS.map((option) => ({
              value: option.value,
              label: t(`sorts.${option.value}`),
            }))}
            value={sort}
            onChange={(next) => updateParams({ sort: next ?? 'RECENT' })}
            required
            className="flex-wrap justify-center"
          />
          <PillFilter
            label={t('board.categoryLabel')}
            options={POST_CATEGORIES.map((option) => ({
              value: option.value,
              label: t(`categories.${option.value}`),
            }))}
            value={category === 'ALL' ? null : category}
            onChange={(next) => updateParams({ category: next ?? 'ALL' })}
            className="flex-wrap justify-center"
          />
        </div>
      }
      title={boardTitle(sort, t('freeBoard.noun'), categoryLabel)}
      items={(posts.data?.posts ?? []).map(postToBoardItem)}
      isPending={posts.isPending}
      totalElements={posts.data?.totalElements}
      onToggleLike={(item) =>
        likeToggle.toggle({ id: item.id, liked: item.liked })
      }
      page={page}
      size={PAGE_SIZE}
      onPageChange={(next) => updateParams({ page: next })}
      paginationLabel={t('freeBoard.pagination')}
    >
      <LoginRequiredDialog
        open={likeToggle.loginRequired}
        onClose={likeToggle.closeLoginRequired}
        redirectTo={ROUTES.COMMUNITY_FREE}
        description={t('board.likeLoginRequired')}
      />
    </BoardShell>
  )
}
