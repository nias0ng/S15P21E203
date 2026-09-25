import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import {
  communityKeys,
  LinkedPerfumeModal,
  WriteForm,
  type LinkedPerfume,
} from '@/features/community'
// 계절은 향수 도메인의 어휘입니다. features/community 는 features/perfume 를
// import 할 수 없으므로(ESLint) 화면에서 두 도메인을 조합합니다.
import {
  createReview,
  perfumeKeys,
  replaceReviewSeasons,
  REVIEW_CONTENT_MAX_LENGTH,
  REVIEW_CONTENT_MIN_LENGTH,
  REVIEW_TITLE_MAX_LENGTH,
  perfumeDetailQuery,
  perfumeListQuery,
  reviewDetailQuery,
  reviewKeys,
  SEASONS,
  updateReview,
  type Season,
} from '@/features/perfume'
import { isApiError } from '@/shared/api/http'
import { ROUTES, toReviewDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Textarea } from '@/shared/ui/Textarea'

/**
 * 수정이 절반만 저장된 경우. 제목 · 본문(`PATCH`)과 계절(`PUT .../seasons`)이
 * **서버에서 각자 트랜잭션**이라 앞이 커밋된 뒤 뒤가 실패할 수 있습니다.
 * 한 번의 `PATCH` 로 합치려면 백엔드가 `seasonCodes` 를 받아야 합니다(별도 이슈).
 */
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

/** 저장 실패를 사용자가 다음에 뭘 해야 할지 아는 문장으로 옮깁니다 */
function saveErrorMessage(error: unknown): string {
  if (error instanceof PartialSaveError) {
    const detail = isApiError(error.reason) ? ` (${error.reason.message})` : ''
    return error.textSaved
      ? `제목과 본문은 저장됐지만 계절을 저장하지 못했습니다${detail}. [수정] 을 다시 눌러주세요.`
      : `계절을 저장하지 못했습니다${detail}. 잠시 후 다시 시도해주세요.`
  }
  return isApiError(error)
    ? error.message
    : '저장하지 못했습니다. 잠시 후 다시 시도해주세요.'
}

/**
 * 후기 작성 · 수정 (A24a — CMT-03 · 06 · DTL-05 · 16). **한 화면이 두 모드**입니다.
 *
 *   /community/reviews/write?perfumeId=7    작성 → POST /perfumes/7/reviews
 *   /community/reviews/12/edit              수정 → PATCH /reviews/12 (+ 계절)
 *
 * **수정에서는 대상 향수를 바꿀 수 없습니다.** 백엔드에 옮기는 경로가 없고
 * (`PATCH` 는 제목 · 내용만 받습니다) 서버가 에러도 안 내서, 버튼을 살려두면
 * 바꿔놓고 저장했는데 조용히 원래대로 남습니다.
 */
export default function ReviewWritePage() {
  const navigate = useNavigate()
  const isLoggedIn = useIsLoggedIn()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const { reviewId: reviewIdParam } = useParams<{ reviewId: string }>()

  const reviewId = Number(reviewIdParam)
  const isEdit = reviewIdParam !== undefined && Number.isFinite(reviewId)

  /**
   * 수정할 후기. **`GET /reviews/{id}` 는 부를 때마다 조회수가 오릅니다** — 그래서
   * `staleTime: Infinity` 로 마운트 재요청을 막습니다. 상세에서 [수정] 을 눌러 온
   * 경우 캐시가 그대로 쓰이고, 주소로 바로 들어와도 한 번만 부릅니다.
   */
  const existing = useQuery({
    ...reviewDetailQuery(reviewId),
    enabled: isEdit,
    staleTime: Infinity,
  })

  /**
   * 입력값은 `null` 로 시작합니다. 서버 값이 오기 전에 `''` 로 두면 빈 칸이 먼저
   * 보였다가 채워지고, `useEffect` 로 밀어넣으면 사용자가 고치는 중에 덮어씁니다.
   * 아직 안 건드린 칸은 `null` 이라 서버 값을 그대로 보여줍니다.
   */
  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  const [contentDraft, setContentDraft] = useState<string | null>(null)
  const [seasonsDraft, setSeasonsDraft] = useState<Season[] | null>(null)

  const loaded = isEdit ? existing.data : undefined

  const title = titleDraft ?? loaded?.title ?? ''
  const content = contentDraft ?? loaded?.content ?? ''
  const seasons =
    seasonsDraft ?? loaded?.seasons.map((season) => season.code) ?? []

  /**
   * 작성 모드의 대상 향수 번호. `?perfumeId=abc` 는 `null` 입니다 — 여기서 걸러야
   * [포스팅] 이 켜졌다가 저장할 때에야 실패하지 않습니다.
   */
  const preselectedId = (() => {
    const raw = searchParams.get('perfumeId')
    if (raw === null) return null
    const parsed = Number(raw)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
  })()

  /* 주소로 실려 온 향수(`?perfumeId=`)가 첫 값이고, [향수 선택] 이 이깁니다 */
  const [pickedPerfume, setPickedPerfume] = useState<LinkedPerfume | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [keyword, setKeyword] = useState('')

  const perfumeId = isEdit
    ? loaded?.perfume.perfumeId
    : (pickedPerfume?.perfumeId ?? preselectedId)

  /* 예전에는 고정값이라 어느 향수로 들어오든 같은 이름이 보였습니다 */
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

  /* 후보는 이 화면이 만듭니다 — 모달(`features/community`)은 향수를 모릅니다 */
  const perfumeSearch = useQuery({
    ...perfumeListQuery({ keyword, size: 20 }),
    enabled: keyword.trim().length > 0,
  })

  const candidates: LinkedPerfume[] = (perfumeSearch.data?.perfumes ?? []).map(
    (perfume) => ({
      perfumeId: perfume.perfumeId,
      name: perfume.nameKo ?? perfume.name,
      brand: perfume.brandName ?? perfume.brandNameKo,
      thumbnailUrl: perfume.imageUrl,
    }),
  )

  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  const titleError =
    trimmedTitle.length > REVIEW_TITLE_MAX_LENGTH
      ? `제목은 ${REVIEW_TITLE_MAX_LENGTH}자 이하여야 합니다`
      : undefined

  /*
   * 서버가 본문 10~1000자를 요구합니다(`@Size`). 화면이 먼저 걸러야 다 쓰고 나서
   * 400 을 받고 돌아오는 왕복이 없습니다.
   */
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
        /*
         * 요청이 둘로 갈립니다 — 백엔드가 계절을 별도 엔드포인트로 뺐습니다.
         * **바뀐 것만 보냅니다.** `PATCH` 는 제목 · 내용이 둘 다 비면 400 이고,
         * 계절은 안 바뀌었는데 교체 요청을 보낼 이유가 없습니다.
         */
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
            /*
             * 두 요청이 **각자 다른 트랜잭션**이라 앞만 커밋될 수 있습니다. 그냥
             * "저장 실패" 라고만 하면 이미 바뀐 제목을 사용자가 모릅니다.
             */
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
      /*
       * 후기가 바뀌면 그 향수의 후기 목록 · 계절 통계 · 후기 요약이 전부 낡습니다.
       * 전부 `perfumeKeys.detail(id)` 아래에 있어 한 줄로 갱신됩니다.
       */
      void queryClient.invalidateQueries({
        queryKey: reviewKeys.detail(savedId),
      })
      if (perfumeId !== undefined && perfumeId !== null) {
        void queryClient.invalidateQueries({
          queryKey: perfumeKeys.detail(perfumeId),
        })
      }
      // 게시판 목록도 낡습니다 (제목 · 계절이 바뀌었을 수 있습니다)
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })

      navigate(toReviewDetail(savedId), { replace: true })
    },
    onSettled: () => {
      if (!isEdit) return

      /*
       * **성공이든 실패든** 낡은 것으로 표시합니다 — 앞만 성공했을 때 캐시를 두면
       * 상세에 옛 제목이 보여 아무것도 저장 안 된 줄 압니다.
       *
       * `refetchType: 'none'` 인 이유: `GET /reviews/{id}` 는 부를 때마다 조회수가
       * 올라, 여기서 다시 부르면 실패한 사람이 제 조회수를 올립니다.
       */
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
    // 서버가 계절을 1개 이상 요구합니다 (@NotEmpty)
    seasons.length > 0 &&
    !mutation.isPending

  if (isEdit && existing.isPending) {
    return <PageFallback />
  }

  /*
   * 빈 칸으로 두면 그 상태로 저장할 때 바뀐 게 없어 요청이 하나도 안 나간 채
   * 상세로 넘어갑니다 — 저장된 것처럼 보이는 가장 나쁜 실패입니다.
   */
  if (isEdit && (existing.isError || loaded === undefined)) {
    return (
      <EmptyState
        title="후기를 불러오지 못했습니다"
        description="주소가 잘못되었거나 삭제된 후기입니다."
        action={
          <LinkButton to={ROUTES.COMMUNITY_REVIEWS} variant="outline" size="sm">
            후기 게시판으로
          </LinkButton>
        }
        onRetry={() => void existing.refetch()}
        retrySize="sm"
      />
    )
  }

  /* 주소로 바로 들어오면 단추를 안 거칩니다. 다 쓰고 막히면 쓴 것을 잃습니다 */
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
        {/* 대상 향수는 필수이고 한 개만 답니다 */}
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
              // 수정할 때는 대상을 바꿀 수 없습니다 — 다른 향수의 후기가 되어 버립니다
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

        {/*
          계절별 평가 (DTL-16). 예전에 "(선택)" 이라고 적혀 있었는데 서버는 1개
          이상을 요구합니다(`@NotEmpty`) — 안 고르고 저장하면 400 이었습니다.
        */}
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
        candidates={candidates}
        isPending={perfumeSearch.isFetching}
        onSearch={setKeyword}
        /* 후기는 향수 한 개에 씁니다 */
        single
        onSubmit={(picked) => {
          if (picked[0]) setPickedPerfume(picked[0])
          setPickOpen(false)
        }}
      />
    </>
  )
}
