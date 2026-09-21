import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { isApiError } from '@/shared/api/http'
import { UNROLL, useUnroll } from '@/shared/hooks/useUnroll'
import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'

import { usePendingFeedbackStore } from '../pendingFeedbackStore'
import { recommendationQuery } from '../queries'

import { RecommendResultList } from './RecommendResultList'

type Props = {
  /** 검색한 말. `null` 이면 닫힌 상태입니다 */
  query: string | null
  onClose: () => void
}

/**
 * 자연어 추천 결과 (NLR-01 · NLR-06 · NLR-07). 별도 화면으로 두면 한 줄 적을 때마다 메인의
 * 3D iframe 이 통째로 다시 떠(WebGL 컨텍스트 · 8MB 배 모델) 모달로 둡니다.
 * NOTE: 가운데 정렬이면 족자가 풀릴 때 머리줄이 밀려 올라가 위쪽에 붙입니다(`mt-25 mb-auto`).
 */
export function RecommendModal({ query, onClose }: Props) {
  return (
    <Modal
      open={query !== null}
      onClose={onClose}
      title="추천 결과"
      className="mt-25 mb-auto w-[min(760px,calc(100vw-40px))]"
    >
      {/* NOTE: `<dialog>` 는 닫혀도 children 이 DOM 에 남아, 그리지 않아야 족자가 다시 풀립니다 */}
      {query !== null && <RecommendBody query={query} />}
    </Modal>
  )
}

/** 열릴 때마다 새로 마운트됩니다 — 그래야 족자가 매번 처음부터 풀립니다 */
function RecommendBody({ query }: { query: string }) {
  /** 지금은 테두리 강조뿐이지만 미니맵이 붙으면 그쪽이 씁니다 */
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { bodyRef, style, inert } = useUnroll()

  const result = useQuery({
    ...recommendationQuery(query),
    enabled: query.trim().length > 0,
  })

  const perfumes = result.data?.perfumes ?? []

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
    <div
      className={cn(
        'overflow-hidden transition-[height] motion-reduce:transition-none',
        UNROLL,
      )}
      style={style}
      inert={inert}
    >
      <div ref={bodyRef}>
        {/* 무엇을 물었는지 결과 위에 남깁니다 — 모달이라 검색창이 뒤에 가려 안 보입니다 */}
        <p className="text-ink-muted text-caption mb-3.75">
          입력한 말 ·{' '}
          <strong className="text-ink font-medium">
            &lsquo;{query}&rsquo;
          </strong>
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
            {result.data.matchedData.length > 0 && perfumes.length > 0 && (
              <p className="border-line text-ink-muted text-caption mb-3.75 border-l-2 pl-2.5 leading-relaxed">
                <strong className="text-ink font-medium">
                  {result.data.matchedData
                    .map((data) => data.label)
                    .join(' · ')}
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
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              /*
                NOTE: 0개인 두 경우를 한 문장으로 묶지 않습니다 — 조건을 못 뽑은 사람에게
                없는 것은 향수가 아니라 알아들은 조건입니다. 인기 향수로 대신하지도 않습니다.
              */
              <EmptyState
                title={
                  result.data.status === 'NO_CONDITION'
                    ? '어떤 향인지 아직 못 알아들었습니다'
                    : '말씀하신 향에 맞는 향수를 찾지 못했습니다'
                }
                description={
                  result.data.status === 'NO_CONDITION'
                    ? '냄새로 풀어서 적어 보세요 — ‘비누 냄새 나는 향’, ‘비 온 뒤 흙냄새’ 처럼요.'
                    : '조건을 조금 줄이면 찾을 수 있습니다. 계절이나 상황 하나를 빼고 다시 적어 보세요.'
                }
              />
            )}
          </>
        )}
      </div>
    </div>
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
