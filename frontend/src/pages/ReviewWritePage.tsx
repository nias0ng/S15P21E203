import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import {
  communityKeys,
  ImageAttachField,
  WriteForm,
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
  reviewDetailQuery,
  reviewKeys,
  SEASONS,
  updateReview,
  type Season,
} from '@/features/perfume'
import { isApiError } from '@/shared/api/http'
import { ROUTES, toReviewDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Textarea } from '@/shared/ui/Textarea'

/**
 * 수정이 절반만 저장된 경우.
 *
 * 제목 · 본문(`PATCH`)과 계절(`PUT .../seasons`)이 **서버에서 각자 트랜잭션**이라,
 * 앞이 커밋된 뒤 뒤가 실패할 수 있습니다. 화면이 되돌릴 수는 없으니 무엇이
 * 남았는지라도 정확히 알려주려고 원인 오류를 감싸 둡니다.
 *
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
 * 후기 게시글 작성 · 수정 (와이어프레임 A24a — CMT-03 · CMT-06 · DTL-05 · DTL-16)
 *
 * **한 화면이 두 모드입니다.** 주소로 가릅니다.
 *
 *   /community/reviews/write?perfumeId=7    작성 → POST /perfumes/7/reviews
 *   /community/reviews/12/edit              수정 → PATCH /reviews/12 (+ 계절)
 *
 * 분류가 없고(전부 후기라서) 대상 향수는 필수 · 한 개입니다.
 *
 * **수정에서는 대상 향수를 바꿀 수 없습니다.** 백엔드에 향수를 옮기는 경로가 없고
 * (`PATCH /reviews/{id}` 는 제목 · 내용만 받습니다), 한 사람이 같은 향수에 후기를
 * 두 개 쓸 수 없어 옮기면 중복이 생깁니다. 버튼을 살려두면 바꿔놓고 저장했는데
 * 조용히 원래대로 남습니다 — 서버가 에러도 내지 않으니 화면이 막아야 합니다.
 */
export default function ReviewWritePage() {
  const navigate = useNavigate()
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
   * 작성 모드의 대상 향수 번호.
   *
   * `?perfumeId=abc` 처럼 숫자가 아닌 값이 오면 `null` 입니다 — 여기서 걸러야
   * [포스팅] 이 켜졌다가 저장할 때에야 실패하는 일이 없습니다.
   */
  const preselectedId = (() => {
    const raw = searchParams.get('perfumeId')
    if (raw === null) return null
    const parsed = Number(raw)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
  })()

  const perfumeId = isEdit ? loaded?.perfume.perfumeId : preselectedId

  // TODO: 작성 모드에서 perfumeId 로 향수를 조회해 이름 · 브랜드를 채우세요
  const targetPerfume = isEdit
    ? loaded
      ? { name: loaded.perfume.name, brand: loaded.perfume.brand }
      : null
    : preselectedId !== null
      ? { name: '조 말론 우드 세이지', brand: '조 말론 런던' }
      : null

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
             * 두 요청은 서버에서 **각자 다른 트랜잭션**입니다(`update` ·
             * `replaceSeasons` 가 각각 `@Transactional`). 앞이 커밋된 뒤 뒤가
             * 실패하면 되돌릴 방법이 없으므로, 무엇이 남았는지 알려주기라도 합니다.
             * 그냥 "저장 실패"라고만 하면 이미 바뀐 제목을 사용자가 모릅니다.
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
       * **성공이든 실패든** 이 후기를 낡은 것으로 표시합니다.
       *
       * 수정은 요청이 둘로 갈려서 앞만 성공하고 뒤가 실패할 수 있습니다. 그때
       * 캐시를 그대로 두면 사용자가 상세로 돌아갔을 때 옛 제목이 보여 "아무것도
       * 저장 안 됐구나" 하고 떠납니다 — 서버에는 이미 바뀌어 있는데도요.
       *
       * `refetchType: 'none'` 인 이유: `GET /reviews/{id}` 는 부를 때마다
       * 조회수가 오릅니다. 여기서 바로 다시 부르면 저장에 실패한 사람이 자기
       * 후기 조회수를 올리게 됩니다. 표시만 해두면 다음에 상세를 열 때 —
       * 어차피 조회인 그 순간에 — 새로 읽습니다.
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
   * 불러오지 못했으면 폼을 그리지 않습니다. 빈 칸으로 두면 "내용이 지워진 수정
   * 화면"으로 보이고, 그 상태로 저장하면 바뀐 게 없어 요청이 하나도 안 나간 채
   * 상세로 넘어갑니다 — 저장된 것처럼 보이는 가장 나쁜 실패입니다.
   */
  if (isEdit && (existing.isError || loaded === undefined)) {
    return (
      <EmptyState
        title="후기를 불러오지 못했습니다"
        description="주소가 잘못되었거나 삭제된 후기입니다."
        action={
          <div className="flex gap-2.5">
            <LinkButton
              to={ROUTES.COMMUNITY_REVIEWS}
              variant="outline"
              size="sm"
            >
              후기 게시판으로
            </LinkButton>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void existing.refetch()}
            >
              다시 시도
            </Button>
          </div>
        }
      />
    )
  }

  return (
    <WriteForm
      title={isEdit ? '후기 수정' : '후기 쓰기'}
      description={
        isEdit
          ? '제목 · 본문 · 계절을 고칠 수 있습니다. 대상 향수는 바꿀 수 없습니다.'
          : '대상 향수는 필수이고 한 개만 답니다. 후기에는 분류가 없습니다.'
      }
      cancelTo={isEdit ? toReviewDetail(reviewId) : ROUTES.COMMUNITY_REVIEWS}
      submitLabel={mutation.isPending ? '저장 중' : isEdit ? '수정' : '포스팅'}
      submitDisabled={!canSubmit}
      onSubmit={() => mutation.mutate()}
    >
      {/*
          대상 향수는 필수이고 한 개만 답니다. 이 화면에서 가장 먼저 정해야 하는
          값이라 다른 항목과 달리 칸으로 감싸 무게를 줍니다 — 고르지 않으면
          [포스팅] 이 꺼져 있는데, 그 이유가 눈에 보여야 합니다.
        */}
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
          {/* TODO: 향수 검색 연결 (화면에서 향수 도메인과 조합) */}
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="ml-auto"
            disabled={isEdit}
          >
            {isEdit ? '변경 불가' : targetPerfume ? '변경' : '향수 선택'}
          </Button>
        </div>

        {isEdit && (
          <p className="text-ink-muted text-caption mt-2">
            대상 향수는 바꿀 수 없습니다. 다른 향수에 쓰시려면 이 후기를 지우고
            새로 작성해주세요.
          </p>
        )}
      </fieldset>

      {/*
          라벨을 보이게 두었습니다. placeholder 로만 알려주면 한 글자라도 치는
          순간 무엇을 적는 칸인지 사라집니다.
        */}
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
          계절별 평가 (DTL-16). 예전에는 향수 상세의 [계절 등록] 단추가 모달을
          띄웠는데, 이 향을 어느 계절에 맡았는지는 후기와 같은 순간에 남기는
          값이라 여기로 옮겼습니다. 입구가 둘이면 한쪽만 쓰이고 다른 쪽은
          잊힙니다.

          네 칸을 같은 폭으로 늘여 한 줄에 놓습니다. 칩이 글자 폭대로 떨어져
          있으면 "봄" 과 "여름" 의 크기가 달라 고르는 대상이 아니라 태그처럼
          보입니다.

          여러 개 고를 수 있습니다 — 봄과 가을에 다 어울리는 향이 있습니다.

          **필수입니다.** 예전에 "(선택)" 이라고 적혀 있었는데 서버는 1개 이상을
          요구합니다(`@NotEmpty`). 그대로 두면 아무것도 안 고르고 저장할 때 400 입니다.
        */}
      <fieldset className="space-y-2">
        <legend className="text-ink text-caption font-medium">
          계절별 평가 <span className="text-danger">*</span>
        </legend>
        <ChipToggle
          label="이 향이 잘 어울리는 계절"
          multiple
          tone="warm"
          options={SEASONS}
          value={seasons}
          onChange={(next) => setSeasonsDraft(next)}
          className="grid grid-cols-4 gap-2"
        />
        <p className="text-ink-muted text-caption">
          최소 한 개는 골라주세요. 여러 개 고를 수 있습니다.
        </p>
      </fieldset>

      <ImageAttachField />

      {mutation.error !== null && (
        <p className="text-danger text-caption" role="alert">
          {saveErrorMessage(mutation.error)}
        </p>
      )}
    </WriteForm>
  )
}
