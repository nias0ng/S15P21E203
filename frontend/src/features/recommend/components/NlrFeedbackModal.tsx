import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { isApiError } from '@/shared/api/http'
import { UNROLL, useUnroll } from '@/shared/hooks/useUnroll'
import { cn } from '@/shared/lib/cn'
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
 * 자리와 움직임은 **결과 모달과 같습니다** — 같은 검색의 뒷장이라, 위쪽에 붙는 것(`mt-25`)도
 * 폭도 족자가 풀리는 것도 맞췄습니다. 자리가 달라지면 사람이 보기에 답을 잇는 화면이 아니라
 * 다른 기능이 끼어든 것으로 읽힙니다 (`MapSearchModal` 이 같은 이유로 같은 자리를 씁니다).
 *
 * NOTE: **건너뛰기와 [×] 는 같습니다.** 어느 쪽으로 닫아도 그 추천은 끝나고 다시 묻지
 * 않습니다. 화면에는 두 단추가 나란히 있을 뿐이라 어느 쪽이 영영 끝인지 알 길이 없는데,
 * 한쪽만 접어 두면 답하지 않기로 한 사람에게 같은 설문이 새로고침마다 다시 뜹니다.
 */
export function NlrFeedbackModal({ ready }: Props) {
  const pending = usePendingFeedbackStore((state) => state.pending)
  const settle = usePendingFeedbackStore((state) => state.settle)

  /** 답을 보낸 손잡이. 손잡이가 바뀌면 저절로 풀립니다 */
  const [answeredToken, setAnsweredToken] = useState<string | null>(null)
  const answered = pending !== null && answeredToken === pending.token

  const close = () => {
    if (pending === null) return
    settle(pending.token)
  }

  const open = ready && pending !== null

  return (
    <Modal
      open={open}
      onClose={close}
      title="추천은 어떠셨나요"
      /*
        자리 · 크기는 `RecommendModal` 과 **한 벌입니다** — 설문이 추천 결과와 같은 자리에서
        이어지게 하려는 것이라, 한쪽만 고치면 두 판이 어긋납니다.
        560(=140×4) 과 125(=31.25×4) 는 1920 기준이고 `--spacing` 을 타 함께 줄어듭니다.
      */
      className="scent-map-panel rounded-glass mt-25 mb-auto max-h-[calc(100vh-var(--spacing)*31.25)] w-140 overflow-y-auto"
    >
      {/*
        `<dialog>` 는 닫혀도 children 이 DOM 에 남습니다. 열림과 **같은 조건**으로 그려야
        족자가 다음에 다시 풀리고, 로딩 중에 검색어가 화면 밖 DOM 에 먼저 앉지도 않습니다.
      */}
      {open && pending !== null && (
        <FeedbackBody
          key={pending.token}
          token={pending.token}
          query={pending.query}
          answered={answered}
          onAnswered={() => setAnsweredToken(pending.token)}
          onSettle={() => settle(pending.token)}
        />
      )}
    </Modal>
  )
}

/** 손잡이마다 새로 마운트됩니다 — 앞 추천에 쓴 한마디가 다음 설문에 남으면 안 됩니다 */
function FeedbackBody(props: {
  token: string
  query: string
  answered: boolean
  onAnswered: () => void
  onSettle: () => void
}) {
  const { bodyRef, style, inert } = useUnroll()

  return (
    <div
      className={cn(
        'overflow-hidden transition-[height] motion-reduce:transition-none',
        UNROLL,
      )}
      style={style}
      inert={inert}
    >
      <div ref={bodyRef}>
        <FeedbackForm {...props} />
      </div>
    </div>
  )
}

/** 족자 안에 들어가는 알맹이 */
function FeedbackForm({
  token,
  query,
  answered,
  onAnswered,
  onSettle,
}: {
  token: string
  query: string
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
          <Button
            className="bg-navy border-line text-ink hover:bg-navy/85 border"
            onClick={onSettle}
          >
            닫기
          </Button>
        </div>
      </>
    )
  }

  const tooLong = comment.length > FEEDBACK_COMMENT_MAX

  return (
    <>
      {/*
        무엇에 답하는 설문인지 먼저 밝힙니다. 상세에 다녀와 받는 설문은 결과 목록도 닫혔고
        검색창도 비어 있어, 이 줄이 없으면 방금 무엇을 물었는지가 화면 어디에도 없습니다.
        결과 모달의 같은 줄과 문구를 맞췄습니다.
      */}
      <p className="text-ink-muted text-caption mb-3.75">
        입력한 말 ·{' '}
        <strong className="text-ink font-medium">&lsquo;{query}&rsquo;</strong>
      </p>

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
          // 판 위의 주 단추는 엔진 카드 단추와 같은 남색입니다 (--pb-card-btn)
          className="bg-navy border-line text-ink hover:bg-navy/85 border"
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
