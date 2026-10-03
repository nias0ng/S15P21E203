import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { i18n } from '@/shared/i18n'
import { localizedBrand, localizedName } from '@/shared/i18n/locale'
import { cn } from '@/shared/lib/cn'
import { parseId } from '@/shared/lib/parseId'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { useLocale } from '@/shared/store/localeStore'
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
    // 영어 화면에서 코드에 맞는 영어 문구가 없으면 한국어 서버 문구를 끼우지 않고 괄호째 뺍니다
    const reason = isApiError(error.reason)
      ? apiErrorMessage(error.reason, '')
      : ''
    const detail = reason === '' ? '' : ` (${reason})`
    return error.textSaved
      ? i18n.t('community:reviewWrite.partialSavedText', { detail })
      : i18n.t('community:reviewWrite.seasonsFailed', { detail })
  }
  return apiErrorMessage(error, i18n.t('community:reviewWrite.saveFailed'))
}

export default function ReviewWritePage() {
  const { t } = useTranslation('community')
  const locale = useLocale()
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
      ? {
          name: localizedName(
            locale,
            loaded.perfume.name,
            loaded.perfume.nameKo,
          ),
          brand: localizedBrand(
            locale,
            loaded.perfume.brand,
            loaded.perfume.brandKo,
          ),
        }
      : null
    : pickedPerfume
      ? { name: pickedPerfume.name, brand: pickedPerfume.brand }
      : preselected.data
        ? {
            name: localizedName(
              locale,
              preselected.data.name,
              preselected.data.nameKo,
            ),
            brand: preselected.data.brand?.name ?? null,
          }
        : null

  const perfumeSearch = useQuery(perfumePickQuery(keyword))

  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  const titleError =
    trimmedTitle.length > REVIEW_TITLE_MAX_LENGTH
      ? t('reviewWrite.titleTooLong', { max: REVIEW_TITLE_MAX_LENGTH })
      : undefined

  const contentError =
    trimmedContent.length > 0 &&
    trimmedContent.length < REVIEW_CONTENT_MIN_LENGTH
      ? t('reviewWrite.contentTooShort', { min: REVIEW_CONTENT_MIN_LENGTH })
      : trimmedContent.length > REVIEW_CONTENT_MAX_LENGTH
        ? t('reviewWrite.contentTooLong', { max: REVIEW_CONTENT_MAX_LENGTH })
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
        title={t('reviewWrite.loadFailedTitle')}
        description={t('reviewWrite.loadFailedDescription')}
        action={
          <LinkButton to={ROUTES.COMMUNITY_REVIEWS} variant="outline" size="sm">
            {t('reviewWrite.backToReviews')}
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
        description={t('reviewWrite.loginRequired')}
      />
    )
  }

  return (
    <>
      <WriteForm
        title={isEdit ? t('reviewWrite.editTitle') : t('reviewWrite.newTitle')}
        description={
          isEdit
            ? t('reviewWrite.editDescription')
            : t('reviewWrite.newDescription')
        }
        cancelTo={isEdit ? toReviewDetail(reviewId) : ROUTES.COMMUNITY_REVIEWS}
        submitLabel={
          mutation.isPending
            ? t('reviewWrite.saving')
            : isEdit
              ? t('reviewWrite.submitEdit')
              : t('reviewWrite.submitNew')
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
            {t('reviewWrite.target')} <span className="text-danger">*</span>
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
                {t('reviewWrite.targetMissing')}
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
              {isEdit
                ? t('reviewWrite.locked')
                : targetPerfume
                  ? t('reviewWrite.change')
                  : t('reviewWrite.pick')}
            </Button>
          </div>

          {isEdit && (
            <p className="text-ink-muted text-caption mt-2">
              {t('reviewWrite.lockedHint')}
            </p>
          )}
        </fieldset>

        <Input
          label={t('reviewWrite.title')}
          placeholder={t('reviewWrite.titlePlaceholder')}
          required
          value={title}
          onChange={(event) => setTitleDraft(event.target.value)}
          error={titleError}
        />

        <Textarea
          label={t('reviewWrite.content')}
          placeholder={t('reviewWrite.contentPlaceholder')}
          rows={12}
          required
          value={content}
          onChange={(event) => setContentDraft(event.target.value)}
          error={contentError}
        />

        <fieldset className="space-y-2">
          <legend className="text-ink text-caption font-medium">
            {t('reviewWrite.seasons')} <span className="text-danger">*</span>
          </legend>
          <ChipToggle
            label={t('reviewWrite.seasonsGroup')}
            multiple
            options={SEASONS.map((option) => ({
              value: option.value,
              label: t(`reviewWrite.seasonNames.${option.value}`),
            }))}
            value={seasons}
            onChange={(next) => setSeasonsDraft(next)}
            className="grid grid-cols-4 gap-2"
          />
          <p className="text-ink-muted text-caption">
            {t('reviewWrite.seasonsHint')}
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
