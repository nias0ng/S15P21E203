import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import {
  communityKeys,
  LinkedPerfumeModal,
  WriteForm,
  type LinkedPerfume,
} from '@/features/community'
import {
  createReview,
  perfumeKeys,
  replaceReviewSeasons,
  REVIEW_CONTENT_MAX_LENGTH,
  REVIEW_CONTENT_MIN_LENGTH,
  REVIEW_TITLE_MAX_LENGTH,
  perfumeDetailQuery,
  perfumePickQuery,
  reviewDetailQuery,
  reviewKeys,
  SEASONS,
  updateReview,
  type Season,
} from '@/features/perfume'
import { apiErrorMessage, isApiError } from '@/shared/api/http'
import { ROUTES, toReviewDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { parseId } from '@/shared/lib/parseId'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Textarea } from '@/shared/ui/Textarea'

class PartialSaveError extends Error {
  readonly textSaved: boolean
  readonly reason: unknown

  constructor(textSaved: boolean, reason: unknown) {
    super('계절을 저장하지 못했습니다')
    this.name = 'PartialSaveError'
    this.textSaved = textSaved
    this.reason = reason
  }
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof PartialSaveError) {
    const detail = isApiError(error.reason) ? ` (${error.reason.message})` : ''
    return error.textSaved
      ? `제목과 본문은 저장됐지만 계절을 저장하지 못했습니다${detail}. [수정] 을 다시 눌러주세요.`
      : `계절을 저장하지 못했습니다${detail}. 잠시 후 다시 시도해주세요.`
  }
  return apiErrorMessage(
    error,
    '저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
  )
}

export default function ReviewWritePage() {
  const navigate = useNavigate()
  const isLoggedIn = useIsLoggedIn()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const { reviewId: reviewIdParam } = useParams<{ reviewId: string }>()

  const reviewId = parseId(reviewIdParam)
  const isEdit = reviewId !== null

  const existing = useQuery({
    ...reviewDetailQuery(reviewId ?? Number.NaN),
    enabled: isEdit,
    staleTime: Infinity,
  })

  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  const [contentDraft, setContentDraft] = useState<string | null>(null)
  const [seasonsDraft, setSeasonsDraft] = useState<Season[] | null>(null)

  const loaded = isEdit ? existing.data : undefined

  const title = titleDraft ?? loaded?.title ?? ''
  const content = contentDraft ?? loaded?.content ?? ''
  const seasons =
    seasonsDraft ?? loaded?.seasons.map((season) => season.code) ?? []

  const preselectedId = parseId(searchParams.get('perfumeId'))

  const [pickedPerfume, setPickedPerfume] = useState<LinkedPerfume | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [keyword, setKeyword] = useState('')

  const perfumeId = isEdit
    ? loaded?.perfume.perfumeId
    : (pickedPerfume?.perfumeId ?? preselectedId)

  const preselected = useQuery({
    ...perfumeDetailQuery(preselectedId ?? Number.NaN),
    enabled: !isEdit && preselectedId !== null && pickedPerfume === null,
  })

  const targetPerfume = isEdit
    ? loaded
      ? { name: loaded.perfume.name, brand: loaded.perfume.brand }
      : null
    : pickedPerfume
      ? { name: pickedPerfume.name, brand: pickedPerfume.brand }
      : preselected.data
        ? {
            name: preselected.data.nameKo ?? preselected.data.name,
            brand: preselected.data.brand?.name ?? null,
          }
        : null

  const perfumeSearch = useQuery(perfumePickQuery(keyword))

  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  const titleError =
    trimmedTitle.length > REVIEW_TITLE_MAX_LENGTH
      ? `제목은 ${REVIEW_TITLE_MAX_LENGTH}자 이하여야 합니다`
      : undefined

  const contentError =
    trimmedContent.length > 0 &&
    trimmedContent.length < REVIEW_CONTENT_MIN_LENGTH
      ? `본문은 ${REVIEW_CONTENT_MIN_LENGTH}자 이상이어야 합니다`
      : trimmedContent.length > REVIEW_CONTENT_MAX_LENGTH
        ? `본문은 ${REVIEW_CONTENT_MAX_LENGTH}자 이하여야 합니다`
        : undefined

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const changed = {
          ...(loaded !== undefined && trimmedTitle !== loaded.title
            ? { title: trimmedTitle }
            : {}),
          ...(loaded !== undefined && trimmedContent !== loaded.content
            ? { content: trimmedContent }
            : {}),
        }

        let textSaved = false
        if (Object.keys(changed).length > 0) {
          await updateReview(reviewId, changed)
          textSaved = true
        }

        const before = loaded?.seasons.map((season) => season.code) ?? []
        const seasonsChanged =
          seasons.length !== before.length ||
          seasons.some((code) => !before.includes(code))

        if (seasonsChanged) {
          try {
            await replaceReviewSeasons(reviewId, seasons)
          } catch (error) {
            throw new PartialSaveError(textSaved, error)
          }
        }

        return reviewId
      }

      if (perfumeId === undefined || perfumeId === null) {
        throw new Error('대상 향수가 없습니다')
      }

      const created = await createReview(perfumeId, {
        title: trimmedTitle,
        content: trimmedContent,
        seasonCodes: seasons,
      })
      return created.reviewId
    },
    onSuccess: (savedId) => {
      void queryClient.invalidateQueries({
        queryKey: reviewKeys.detail(savedId),
      })
      if (perfumeId !== undefined && perfumeId !== null) {
        void queryClient.invalidateQueries({
          queryKey: perfumeKeys.detail(perfumeId),
        })
      }
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })

      navigate(toReviewDetail(savedId), { replace: true })
    },
    onSettled: () => {
      if (!isEdit) return

      void queryClient.invalidateQueries({
        queryKey: reviewKeys.detail(reviewId),
        refetchType: 'none',
      })
    },
  })

  const canSubmit =
    targetPerfume !== null &&
    trimmedTitle.length > 0 &&
    titleError === undefined &&
    trimmedContent.length >= REVIEW_CONTENT_MIN_LENGTH &&
    contentError === undefined &&
    seasons.length > 0 &&
    !mutation.isPending

  if (isEdit && existing.isPending) {
    return <PageFallback />
  }

  if (
    reviewIdParam !== undefined &&
    (existing.isError || loaded === undefined)
  ) {
    return (
      <EmptyState
        title="후기를 불러오지 못했습니다"
        description="주소가 잘못되었거나 삭제된 후기입니다."
        action={
          <LinkButton to={ROUTES.COMMUNITY_REVIEWS} variant="outline" size="sm">
            후기 게시판으로
          </LinkButton>
        }
        onRetry={isEdit ? () => void existing.refetch() : undefined}
        retrySize="sm"
      />
    )
  }

  if (!isLoggedIn) {
    return (
      <LoginRequiredDialog
        open
        onClose={() => navigate(ROUTES.COMMUNITY_REVIEWS, { replace: true })}
        description="후기는 로그인한 뒤에 쓸 수 있습니다."
      />
    )
  }

  return (
    <>
      <WriteForm
        title={isEdit ? '후기 수정' : '후기 쓰기'}
        description={
          isEdit
            ? '제목 · 본문 · 계절을 고칠 수 있습니다. 대상 향수는 바꿀 수 없습니다.'
            : '대상 향수는 필수이고 한 개만 답니다. 후기에는 분류가 없습니다.'
        }
        cancelTo={isEdit ? toReviewDetail(reviewId) : ROUTES.COMMUNITY_REVIEWS}
        submitLabel={
          mutation.isPending ? '저장 중' : isEdit ? '수정' : '포스팅'
        }
        submitDisabled={!canSubmit}
        onSubmit={() => mutation.mutate()}
      >
        <fieldset
          className={cn(
            'rounded-card border p-3.75',
            targetPerfume
              ? 'border-line-soft bg-surface-sunken'
              : 'border-danger bg-surface-card',
          )}
        >
          <legend className="text-ink text-caption px-1.25 font-medium">
            대상 향수 <span className="text-danger">*</span>
          </legend>

          <div className="flex flex-wrap items-center gap-2.5">
            {targetPerfume ? (
              <>
                <span className="text-ink text-body font-medium">
                  {targetPerfume.name}
                </span>
                <span className="text-ink-muted text-caption">
                  {targetPerfume.brand}
                </span>
              </>
            ) : (
              <span className="text-ink-muted text-body">
                향수를 선택해야 후기를 쓸 수 있습니다
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="ml-auto"
              disabled={isEdit}
              onClick={() => setPickOpen(true)}
            >
              {isEdit ? '변경 불가' : targetPerfume ? '변경' : '향수 선택'}
            </Button>
          </div>

          {isEdit && (
            <p className="text-ink-muted text-caption mt-2">
              대상 향수는 바꿀 수 없습니다. 다른 향수에 쓰시려면 이 후기를
              지우고 새로 작성해주세요.
            </p>
          )}
        </fieldset>

        <Input
          label="제목"
          placeholder="제목을 입력하세요"
          required
          value={title}
          onChange={(event) => setTitleDraft(event.target.value)}
          error={titleError}
        />

        <Textarea
          label="본문"
          placeholder="이 향을 어떻게 맡았는지 적어주세요"
          rows={12}
          required
          value={content}
          onChange={(event) => setContentDraft(event.target.value)}
          error={contentError}
        />

        <fieldset className="space-y-2">
          <legend className="text-ink text-caption font-medium">
            계절별 평가 <span className="text-danger">*</span>
          </legend>
          <ChipToggle
            label="이 향이 잘 어울리는 계절"
            multiple
            options={SEASONS}
            value={seasons}
            onChange={(next) => setSeasonsDraft(next)}
            className="grid grid-cols-4 gap-2"
          />
          <p className="text-ink-muted text-caption">
            최소 한 개는 골라주세요. 여러 개 고를 수 있습니다.
          </p>
        </fieldset>

        {mutation.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {saveErrorMessage(mutation.error)}
          </p>
        )}
      </WriteForm>
      <LinkedPerfumeModal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        candidates={perfumeSearch.data ?? []}
        isPending={perfumeSearch.isFetching}
        onSearch={setKeyword}
        single
        onSubmit={(picked) => {
          if (picked[0]) setPickedPerfume(picked[0])
          setPickOpen(false)
        }}
      />
    </>
  )
}
