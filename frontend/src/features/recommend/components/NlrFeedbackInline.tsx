import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { isApiError } from '@/shared/api/http'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { Textarea } from '@/shared/ui/Textarea'

import { useAnsweredFeedbackStore } from '../answeredFeedbackStore'
import { sendRecommendFeedback } from '../api'
import { FEEDBACK_COMMENT_MAX, type Satisfaction } from '../types'

const OPTIONS = [
  { value: 'SATISFIED', label: '마음에 들어요' },
  { value: 'NEUTRAL', label: '보통이에요' },
  { value: 'DISSATISFIED', label: '아쉬워요' },
] as const satisfies readonly { value: Satisfaction; label: string }[]

type Props = {
  /** 만족도를 보낼 추천의 손잡이 */
  token: string
}

/**
 * 추천 만족도 — **결과창 안의 한 줄** (NLR-08 · 2026-10-01).
 *
 * 예전에는 결과창을 닫으면 설문 창이 따로 떴습니다. 사용성 테스트에서 7명 중 6명이 그것을 짚었습니다 —
 * 결과를 닫을 때마다 끼어들고, 떠 있는 동안 다음 검색이 막히고, 상세에 다녀오면 결과 대신 설문이
 * 먼저 떴습니다. 이제는 결과 아래에 늘 같이 있고, 답하지 않고 닫아도 아무것도 끼어들지 않습니다.
 *
 * 고르면 한마디 칸과 [보내기]가 펼쳐집니다 — 서버가 한 추천에 한 번만 받아(두 번째는 409) 만족도와
 * 한마디를 **같이** 보내야 해서, 고르는 즉시 보내지 않습니다.
 *
 * NOTE: 결과가 0개이거나 손잡이가 없으면 그리지 않습니다(`RecommendModal`). 0개는 추천이 없었던
 * 것이라 답할 것이 없고, 손잡이가 없으면 서버가 기록에 실패해 보낼 곳이 없습니다.
 */
export function NlrFeedbackInline({ token }: Props) {
  const answered = useAnsweredFeedbackStore((state) =>
    state.answered.includes(token),
  )
  const markAnswered = useAnsweredFeedbackStore((state) => state.markAnswered)
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null)
  const [comment, setComment] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      sendRecommendFeedback(token, {
        satisfaction: satisfaction as Satisfaction,
        // 빈 문자열을 보내면 "한마디를 썼는데 비어 있는" 줄이 쌓입니다
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => markAnswered(token),
    onError: (error) => {
      // 409 는 이미 남겼다는 뜻이라 실패가 아닙니다 — 서버가 처음 답을 지킵니다
      if (isApiError(error) && error.status === 409) markAnswered(token)
    },
  })

  if (answered) {
    return (
      <p
        role="status"
        className="border-line text-ink-muted text-caption mt-5 border-t pt-3.75"
      >
        고맙습니다. 남겨 주신 답은 추천을 넓히는 데만 씁니다.
      </p>
    )
  }

  const tooLong = comment.length > FEEDBACK_COMMENT_MAX

  return (
    <section
      aria-labelledby="nlr-feedback-title"
      className="border-line mt-5 border-t pt-3.75"
    >
      <div className="flex flex-wrap items-center gap-x-3.75 gap-y-2.5">
        <h3 id="nlr-feedback-title" className="text-body text-ink font-medium">
          이 추천은 어떠셨나요?
        </h3>
        <ChipToggle
          label="추천 만족도"
          options={OPTIONS}
          value={satisfaction}
          onChange={setSatisfaction}
        />
      </div>

      {/* 고르기 전에는 접어 둡니다 — 답하지 않을 사람에게 빈 칸을 펼쳐 두면 결과보다 설문이 커 보입니다 */}
      {satisfaction !== null && (
        <div className="mt-3.75">
          <Textarea
            label="한마디 (선택)"
            rows={2}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="어떤 점이 좋았는지, 무엇이 아쉬웠는지 적어 주세요"
            error={
              tooLong
                ? `${FEEDBACK_COMMENT_MAX}자까지 쓸 수 있습니다`
                : undefined
            }
          />

          {mutation.isError && (
            <p role="alert" className="text-caption text-danger mt-2.5">
              <FeedbackErrorText error={mutation.error} />
            </p>
          )}

          <div className="mt-2.5 flex justify-end">
            <Button
              variant="navy"
              size="sm"
              onClick={() => mutation.mutate()}
              disabled={tooLong}
              isLoading={mutation.isPending}
            >
              보내기
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

/** 429 는 기다리면 풀리고 404 는 그 추천이 이미 지워진 것이라, 한 문장으로 묶지 않습니다 */
function FeedbackErrorText({ error }: { error: unknown }) {
  const status = isApiError(error) ? error.status : null

  if (status === 429)
    return <>짧은 시간에 여러 번 보내셨습니다. 잠시 뒤에 다시 됩니다.</>
  if (status === 404)
    return <>이 추천의 기록이 남아 있지 않아 보내지 못했습니다.</>

  return <>답을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.</>
}
