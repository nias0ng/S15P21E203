import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { isApiError } from '@/shared/api/http'
import { searchWords } from '@/shared/lib/searchWords'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Unroll } from '@/shared/ui/Unroll'

import { usePendingFeedbackStore } from '../pendingFeedbackStore'
import { recommendationQuery } from '../queries'

import { RecommendResultList } from './RecommendResultList'

type Props = {
  /** 검색한 말. `null` 이면 닫힌 상태입니다 */
  query: string | null
  onClose: () => void
  /** 예시를 눌러 그 말로 다시 찾습니다. 없으면 예시를 글로만 보여 줍니다 */
  onRequery?: (query: string) => void
  /** 향수 이름으로 전체 향수(A09)에서 찾습니다. 없으면 그 단추를 안 둡니다 */
  onSearchByName?: (keyword: string) => void
}

/**
 * 못 알아들었을 때 권하는 말.
 *
 * ⚠️ **LLM 없이 사전만으로 결과가 나오는 말만 둡니다** — `ai/tests/test_feedback_guards.py`
 * 가 같은 두 말을 봅니다. 예전 예시('비누 냄새 나는 향' · '비 온 뒤 흙냄새')는 사전 경로에서
 * 다시 '못 알아들었다' 로 끝나, 권한 말을 따라 친 사람이 같은 화면을 또 봤습니다.
 */
const RETRY_EXAMPLES = ['상큼한 향', '풀향'] as const

/**
 * 자연어 추천 결과 (NLR-01 · NLR-06 · NLR-07). 별도 화면으로 두면 한 줄 적을 때마다 메인의
 * 3D iframe 이 통째로 다시 떠(WebGL 컨텍스트 · 8MB 배 모델) 모달로 둡니다.
 * NOTE: 가운데 정렬이면 족자가 풀릴 때 머리줄이 밀려 올라가 위쪽에 붙입니다(`mt-25 mb-auto`).
 */
export function RecommendModal({
  query,
  onClose,
  onRequery,
  onSearchByName,
}: Props) {
  return (
    <Modal
      open={query !== null}
      onClose={onClose}
      title="추천 결과"
      /*
        배경을 눌러도 닫지 않습니다. 판이 3D 바다 위에 떠 있어 배경이 화면의 대부분이고,
        결과를 읽다 옆을 잘못 누르면 다섯 장이 통째로 사라집니다 — 다시 보려면 검색어를
        처음부터 다시 적어야 합니다. 나가는 길은 [×] 와 Esc 입니다.
      */
      closeOnBackdrop={false}
      /*
        판은 내용에 맞춰 섭니다 — 높이를 못 박으면 접혔을 때 아래가 넓게 빕니다.
        **카드를 펼쳐도 판이 안 자라는 일은 `RecommendResultList` 가 맡습니다** — 목록이
        다 접힌 높이를 지키고 넘치는 만큼 제 안에서 굴러갑니다. 그래서 여기 상한은 판이
        자라는 것을 막는 장치가 아니라, 아래의 낮은 화면 대비입니다.

        NOTE: 낮은 화면에서만 판이 스스로 굴러갑니다. 1920 에서는 다섯 장이 다 들어가
        휠이 안 생기고(실측 817px < 955px), 1280×800 처럼 낮은 화면에서는 이 상한이 없으면
        다섯 번째 카드가 화면 밖으로 잘려 **닿을 길이 없습니다.**

        NOTE: 560(=140×4) 과 125(=31.25×4) 는 **1920 기준**입니다 — 둘 다 `--spacing` 을 타
        좁은 화면에서 같은 비율로 줄어듭니다. 위 실측값도 1920 기준이고, 1536 에서는 판과
        카드가 함께 80% 로 줄어 관계가 그대로 유지됩니다. 가로의 좁은 창 상한은 `Modal` 의
        `max-w` 가 이미 같은 값으로 잡습니다.
      */
      className="scent-map-panel rounded-glass mt-25 mb-auto max-h-[calc(100vh-var(--spacing)*31.25)] w-140 overflow-y-auto"
    >
      {/* NOTE: `<dialog>` 는 닫혀도 children 이 DOM 에 남아, 그리지 않아야 족자가 다시 풀립니다 */}
      {query !== null && (
        <RecommendBody
          // 예시로 다시 찾으면 말이 바뀝니다 — 새로 마운트해야 족자가 다시 풀립니다
          key={query}
          query={query}
          onRequery={onRequery}
          onSearchByName={onSearchByName}
        />
      )}
    </Modal>
  )
}

/** 열릴 때마다 새로 마운트됩니다 — 그래야 족자가 매번 처음부터 풀립니다 */
function RecommendBody({
  query,
  onRequery,
  onSearchByName,
}: {
  query: string
  onRequery?: (query: string) => void
  onSearchByName?: (keyword: string) => void
}) {
  const result = useQuery({
    ...recommendationQuery(query),
    enabled: query.trim().length > 0,
  })

  const perfumes = result.data?.perfumes ?? []
  /*
    계약상 늘 오는 자리지만 `?? []` 로 받습니다 — 이 줄이 없으면 필드가 빠진 응답 하나에
    `length` 를 읽다 모달이 통째로 에러 바운더리로 떨어집니다. 서버가 낡아 이 필드를
    모르는 동안, 안 나와도 되는 근거 한 줄 때문에 추천 전체가 안 보이면 안 됩니다.
  */
  const matchedData = result.data?.matchedData ?? []

  /*
    결과가 **도착하는 순간** 설문을 걸어 둡니다. 닫을 때 걸면 늦습니다 — 결과에서
    [자세히 보기]는 링크라, 상세로 넘어갈 때 이 모달의 `onClose` 가 불리지 않고
    화면째 언마운트됩니다. 그때 걸어 둘 곳이 없으면 답하지 않은 설문이 통째로 사라집니다.

    NOTE: 향수가 0개면 걸지 않습니다. `NO_CONDITION` · `NO_RESULT` 는 추천이 없었던 것이라
    "추천은 어떠셨나요" 에 답할 것이 없고, 그 답을 만족도로 세면 추천의 품질이 아니라
    입력을 못 알아들은 횟수를 만족도에 섞게 됩니다.
    NOTE: 손잡이가 `null` 인 경우도 있습니다 — 서버가 기록에 실패한 것이라 보낼 곳이 없습니다.
  */
  const hold = usePendingFeedbackStore((state) => state.hold)
  const token = result.data?.recommendationToken ?? null
  const hasPerfumes = perfumes.length > 0
  useEffect(() => {
    if (token !== null && hasPerfumes) hold({ token, query })
  }, [token, query, hasPerfumes, hold])

  return (
    <Unroll>
      {/* 무엇을 물었는지 결과 위에 남깁니다 — 모달이라 검색창이 뒤에 가려 안 보입니다 */}
      <p className="text-ink-muted text-caption mb-3.75">
        입력한 말 ·{' '}
        <strong className="text-ink font-medium">&lsquo;{query}&rsquo;</strong>
      </p>

      {result.isPending && <RecommendSkeleton />}

      {result.isError && <RecommendError error={result.error} />}

      {result.isSuccess && (
        <>
          {/*
              NOTE: 향이 아닌 근거는 **반드시 그립니다.** 노트를 말한 문장은 AI 가 그 말을
              accord 로 풀어 보내면서 어느 글자에서 왔는지를 안 채워, 카드의 추천 이유에는
              사용자가 쓴 말이 안 남습니다. 이 줄을 빼면 "미모사랑 장미 들어간 향수" 를 찾은
              사람의 화면에서 미모사도 장미도 사라집니다.
            */}
          {matchedData.length > 0 && perfumes.length > 0 && (
            <p className="border-line text-ink-muted text-caption mb-3.75 border-l-2 pl-2.5 leading-relaxed">
              <strong className="text-ink font-medium">
                {matchedData.map((data) => data.label).join(' · ')}
              </strong>{' '}
              조건으로 좁혔습니다.
            </p>
          )}

          {/* 왜 헐거운지 안 밝히면 조건 하나로 나온 다섯 개를 정확한 추천으로 읽습니다 */}
          {result.data.status === 'OK_RELAXED' && perfumes.length > 0 && (
            <p className="border-line text-ink-muted text-caption mb-3.75 border-l-2 pl-2.5 leading-relaxed">
              {result.data.pickedWithoutScentCondition
                ? /*
                      NOTE: 향으로 고른 것이 아닌 경우를 "조건이 넓다" 로 묶으면 거짓말이 됩니다.
                      향 조건을 하나도 못 뽑았고 순서를 정한 것은 평가자 수입니다.
                    */
                  '향을 말씀하신 것으로 읽지 못해, 위 조건에 맞는 향수를 평가가 많은 순으로 골랐습니다. 냄새로 풀어서 한 줄 덧붙이면 향으로 골라 드릴 수 있습니다.'
                : '조건이 넓어 비슷한 향까지 함께 골랐습니다. 상황이나 계절을 덧붙이면 더 좁혀 드릴 수 있습니다.'}
            </p>
          )}

          {perfumes.length > 0 ? (
            <RecommendResultList
              perfumes={perfumes}
              query={result.data.query}
              pickedWithoutScentCondition={
                result.data.pickedWithoutScentCondition
              }
            />
          ) : result.data.status === 'NO_CONDITION' ? (
            /*
                NOTE: 0개인 두 경우를 한 문장으로 묶지 않습니다 — 조건을 못 뽑은 사람에게
                없는 것은 향수가 아니라 알아들은 조건입니다. 인기 향수로 대신하지도 않습니다.
              */
            <NoConditionState
              query={query}
              onRequery={onRequery}
              onSearchByName={onSearchByName}
            />
          ) : (
            <EmptyState
              title="말씀하신 향에 맞는 향수를 찾지 못했습니다"
              description="조건을 조금 줄이면 찾을 수 있습니다. 계절이나 상황 하나를 빼고 다시 적어 보세요."
            />
          )}
        </>
      )}
    </Unroll>
  )
}

/**
 * 향 조건을 하나도 못 뽑은 경우.
 *
 * 이 화면에 오는 사람의 상당수는 **향수 이름을 친 사람**입니다 — "미르토 디 파나레아와
 * 비슷한 향수" 처럼요 (지인 피드백 F1 · F2). '자연어' 가 무엇인지 몰라 아는 향수 이름을
 * 넣은 것이라, 냄새로 풀어 쓰라는 말만 두면 다음 할 일이 없습니다. 그래서 두 길을 둡니다.
 *
 *   예시 칩        → 그 말로 다시 찾습니다
 *   이름으로 찾기   → 찾는 말투를 걷어 낸 낱말로 전체 향수(A09)에서 찾습니다
 */
function NoConditionState({
  query,
  onRequery,
  onSearchByName,
}: {
  query: string
  onRequery?: (query: string) => void
  onSearchByName?: (keyword: string) => void
}) {
  const nameKeyword = searchWords(query).join(' ')

  return (
    <EmptyState
      title="어떤 향인지 아직 못 알아들었습니다"
      description={
        onRequery
          ? '냄새나 느낌으로 적어 보세요. 아래 말로 바로 찾아볼 수도 있습니다.'
          : `냄새나 느낌으로 적어 보세요 — ${RETRY_EXAMPLES.map((example) => `‘${example}’`).join(', ')} 처럼요.`
      }
      action={
        <div className="flex flex-col items-center gap-2.5">
          {onRequery && (
            <div className="flex flex-wrap justify-center gap-2.5">
              {RETRY_EXAMPLES.map((example) => (
                <Button
                  key={example}
                  variant="outline"
                  size="sm"
                  onClick={() => onRequery(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          )}
          {onSearchByName && nameKeyword && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSearchByName(nameKeyword)}
            >
              향수 이름이었다면 · 전체 향수에서 &lsquo;{nameKeyword}&rsquo; 찾기
            </Button>
          )}
        </div>
      }
    />
  )
}

/**
 * 429 는 기다리면 풀리지만 503 은 추천 서버가 죽은 것이고 그 사이 다른 기능은 멀쩡해서,
 * 둘을 "잠시 후 다시" 로 묶으면 안 됩니다.
 */
function RecommendError({ error }: { error: unknown }) {
  const status = isApiError(error) ? error.status : null

  if (status === 429) {
    return (
      <EmptyState
        title="조금 쉬었다 찾아 주세요"
        description="짧은 시간에 여러 번 찾으셨습니다. 잠시 뒤에 다시 됩니다."
      />
    )
  }

  if (status === 503) {
    return (
      <EmptyState
        title="추천 서버가 지금 답하지 않습니다"
        description="향수 찾기 · 진열대 같은 다른 기능은 그대로 쓰실 수 있습니다."
      />
    )
  }

  return (
    <EmptyState
      title="추천을 불러오지 못했습니다"
      description="잠시 후 다시 시도해 주세요."
    />
  )
}

/** 결과가 3~5개 가변이라 가장 적은 수로 자리를 잡습니다 */
function RecommendSkeleton() {
  return (
    <ul className="space-y-2.5">
      {[0, 1, 2].map((row) => (
        <li key={row}>
          <Skeleton className="h-21.25 w-full" />
        </li>
      ))}
    </ul>
  )
}
