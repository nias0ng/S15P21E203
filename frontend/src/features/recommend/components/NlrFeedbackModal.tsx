import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { isApiError } from '@/shared/api/http'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { Modal } from '@/shared/ui/Modal'
import { Textarea } from '@/shared/ui/Textarea'

import { sendRecommendFeedback } from '../api'
import { usePendingFeedbackStore } from '../pendingFeedbackStore'
import { FEEDBACK_COMMENT_MAX, type Satisfaction } from '../types'

type Props = {
  /**
   * 화면이 설문을 띄워도 되는 상태인가. 메인은 돌아올 때마다 3D 엔진이 처음부터 다시 뜨고
   * 로딩 커튼이 화면을 덮는데, 그 위로 설문을 올리면 바다를 보기도 전에 답부터 묻게 됩니다.
   */
  ready: boolean
}

/**
 * 고를 세 가지. **점수가 아닙니다** — 자세한 사정은 `types.ts` 의 `Satisfaction` 주석에
 * 있습니다. 저장 값(영문)과 화면 문구를 떼어 두어, 문구를 손봐도 쌓인 데이터는 그대로입니다.
 *
 * NOTE: 문구를 "만족 · 보통 · 불만족" 으로 두지 않았습니다. 그건 평가지의 말이라, 방금
 * 향수를 고른 사람에게는 채점당하는 쪽이 사용자처럼 읽힙니다.
 */
const OPTIONS = [
  { value: 'SATISFIED', label: '마음에 들어요' },
  { value: 'NEUTRAL', label: '보통이에요' },
  { value: 'DISSATISFIED', label: '아쉬워요' },
] as const satisfies readonly { value: Satisfaction; label: string }[]

/**
 * 추천 만족도 설문 (NLR-08). 결과 모달을 닫은 **뒤에** 뜹니다 — 결과 안에 두면 향수를
 * 보는 중에 답을 묻게 되고, 그때의 답은 추천이 아니라 화면에 대한 답입니다.
 *
 * 무엇을 물을지는 스토어(`usePendingFeedbackStore`)가 들고 있습니다. 결과에서 [자세히 보기]로
 * 상세에 다녀오면 이 화면이 통째로 다시 서는데, 답하지 않은 설문은 그때 이어서 떠야 합니다.
 *
 * NOTE: 건너뛰기와 [×] 는 다릅니다. **건너뛰기는 그 추천을 끝내고**, [×] · Esc · 배경은
 * 접어 두기만 해서 메인으로 돌아올 때 다시 묻습니다. 답을 강요하지 않으면서, 나가는 길을
 * 잘못 눌러 기록이 통째로 사라지는 일도 막습니다.
 */
export function NlrFeedbackModal({ ready }: Props) {
  const token = usePendingFeedbackStore((state) => state.token)
  const snoozed = usePendingFeedbackStore((state) => state.snoozed)
  const settle = usePendingFeedbackStore((state) => state.settle)
  const snooze = usePendingFeedbackStore((state) => state.snooze)

  /** 답을 보낸 손잡이. 손잡이가 바뀌면 저절로 풀립니다 */
  const [answeredToken, setAnsweredToken] = useState<string | null>(null)
  const answered = token !== null && answeredToken === token

  const close = () => {
    if (token === null) return
    // 답한 뒤에 [×] 로 나가는 것은 접어 두는 것이 아니라 끝낸 것입니다
    if (answered) settle(token)
    else snooze()
  }

  return (
    <Modal
      open={ready && token !== null && !snoozed}
      onClose={close}
      title="추천은 어떠셨나요"
      className="w-[min(460px,calc(100vw-40px))]"
    >
      {/* `<dialog>` 는 닫혀도 children 이 DOM 에 남아, 그리지 않아야 다음 설문이 빈 칸에서 시작합니다 */}
      {token !== null && (
        <FeedbackBody
          key={token}
          token={token}
          answered={answered}
          onAnswered={() => setAnsweredToken(token)}
          onSettle={() => settle(token)}
        />
      )}
    </Modal>
  )
}

/** 손잡이마다 새로 마운트됩니다 — 앞 추천에 쓴 한마디가 다음 설문에 남으면 안 됩니다 */
function FeedbackBody({
  token,
  answered,
  onAnswered,
  onSettle,
}: {
  token: string
  answered: boolean
  onAnswered: () => void
  onSettle: () => void
}) {
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null)
  const [comment, setComment] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      sendRecommendFeedback(token, {
        satisfaction: satisfaction as Satisfaction,
        // 빈 문자열을 보내면 "한마디를 썼는데 비어 있는" 줄이 쌓입니다
        comment: comment.trim() || undefined,
      }),
    onSuccess: onAnswered,
    onError: (error) => {
      // 409 는 이미 남겼다는 뜻이라 실패가 아닙니다 — 서버가 처음 답을 지킵니다
      if (isApiError(error) && error.status === 409) onAnswered()
    },
  })

  if (answered) {
    return (
      <>
        <p className="text-body leading-relaxed">
          고맙습니다. 남겨 주신 답은 추천을 넓히는 데만 씁니다.
        </p>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onSettle}>
            닫기
          </Button>
        </div>
      </>
    )
  }

  const tooLong = comment.length > FEEDBACK_COMMENT_MAX

  return (
    <>
      <ChipToggle
        label="추천 만족도"
        options={OPTIONS}
        value={satisfaction}
        onChange={setSatisfaction}
      />

      <div className="mt-3.75">
        <Textarea
          label="한마디 (선택)"
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="어떤 점이 좋았는지, 무엇이 아쉬웠는지 적어 주세요"
          error={
            tooLong ? `${FEEDBACK_COMMENT_MAX}자까지 쓸 수 있습니다` : undefined
          }
        />
      </div>

      {mutation.isError && (
        <p role="alert" className="text-caption text-danger mt-2.5">
          <FeedbackErrorText error={mutation.error} />
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2.5">
        {/* 답하지 않고 끝내는 길입니다 — [×] 와 달리 이 추천은 다시 묻지 않습니다 */}
        <Button variant="ghost" onClick={onSettle}>
          건너뛰기
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={satisfaction === null || tooLong}
          isLoading={mutation.isPending}
        >
          보내기
        </Button>
      </div>
    </>
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
