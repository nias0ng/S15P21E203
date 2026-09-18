import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { isApiError } from '@/shared/api/http'
import { UNROLL, useUnroll } from '@/shared/hooks/useUnroll'
import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'

import { recommendationQuery } from '../queries'

import { RecommendResultList } from './RecommendResultList'

type Props = {
  /** 검색한 말. `null` 이면 닫힌 상태입니다 */
  query: string | null
  onClose: () => void
}

/**
 * 자연어 추천 결과 (NLR-01 · NLR-06 · NLR-07).
 *
 * **화면이 아니라 모달입니다.** 전에는 `/recommend?q=` 라는 별도 화면이었는데,
 * 그러면 메인에서 한 줄 적을 때마다 3D 가 통째로 내려갔다가(iframe 이라 WebGL
 * 컨텍스트와 8MB 배 모델을 새로 받습니다) 뒤로가기로 다시 떴습니다. 추천은
 * 지도를 떠날 일이 아니라 지도 위에서 보는 것이라, 뒤에 3D 를 남겨 둡니다.
 *
 * 그래서 폭도 공용 모달 기본값(510)보다 넓습니다 — 카드에 향수 사진 · 이름 ·
 * 추천 이유 세 줄이 함께 들어갑니다.
 *
 * ⚠️ **화면 위쪽에 붙여 둡니다** (`mt-25 mb-auto` — 공용 모달의 `m-auto` 를 덮습니다).
 * 가운데 정렬이면 족자가 풀릴 때 판이 위아래로 **함께** 퍼져 머리줄("추천 결과")이
 * 위로 밀려 올라갑니다. 족자는 위 축이 제자리에 있어야 아래로 풀리는 것으로 읽힙니다.
 */
export function RecommendModal({ query, onClose }: Props) {
  return (
    <Modal
      open={query !== null}
      onClose={onClose}
      title="추천 결과"
      className="mt-25 mb-auto w-[min(760px,calc(100vw-40px))]"
    >
      {/*
        ⚠️ 닫혀 있으면 **내용을 아예 그리지 않습니다.** `<dialog>` 는 닫혀도 children 이
        DOM 에 남는데, 그러면 다음에 열 때 족자가 이미 풀린 채라 다시 풀리지 않습니다.
      */}
      {query !== null && <RecommendBody query={query} />}
    </Modal>
  )
}

/** 열릴 때마다 새로 마운트됩니다 — 그래야 족자가 매번 처음부터 풀립니다 */
function RecommendBody({ query }: { query: string }) {
  /** 카드 하나를 고른 상태. 지금은 테두리 강조뿐이지만 미니맵이 붙으면 그쪽이 씁니다 */
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { bodyRef, style, inert } = useUnroll()

  const result = useQuery({
    ...recommendationQuery(query),
    enabled: query.trim().length > 0,
  })

  const perfumes = result.data?.perfumes ?? []

  return (
    /*
     * 향해 일지와 같은 족자입니다 — 모달 머리줄("추천 결과")이 위 축이고 그 아래가
     * 풀려 내려옵니다. 불러오는 중(자리표시 세 칸) → 결과로 바뀔 때도 끊기지 않고
     * 그만큼 이어서 늘어납니다 (`useUnroll` 이 높이를 다시 잽니다).
     */
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
        <p className="text-ink-muted mb-3.75 text-[11px]">
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
              조건을 넓혀서 찾은 결과입니다. 결과는 그대로 보여주되 **왜 헐거운지** 를 먼저
              밝힙니다 — 안 밝히면 "차분한 향" 하나로 나온 다섯 개를 정확한 추천으로 읽습니다
            */}
            {result.data.status === 'OK_RELAXED' && perfumes.length > 0 && (
              <p className="border-line text-ink-muted mb-3.75 border-l-2 pl-2.5 text-[11px] leading-relaxed">
                조건이 넓어 비슷한 향까지 함께 골랐습니다. 상황이나 계절을
                덧붙이면 더 좁혀 드릴 수 있습니다.
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
                ⚠️ 0개인 두 경우를 **한 문장으로 묶으면 안 됩니다.** 향 조건을 못 뽑은
                사람에게 "그런 향수가 없습니다" 라고 하면 거짓말이 됩니다 — 그 사람에게
                없는 것은 향수가 아니라 우리가 알아들은 조건입니다.
                ⚠️ 어느 쪽이든 **인기 향수를 대신 보여주지 않습니다** (NLR-07).
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
 * 추천만 나는 오류 둘을 갈라 말합니다.
 *
 * **429 · 503 을 "잠시 후 다시" 로 묶으면 안 됩니다.** 429 는 기다리면 풀리지만 503 은
 * 추천 서버가 죽은 것이라 기다려도 그대로일 수 있고, 그 사이 **다른 기능은 멀쩡합니다** —
 * 그 말을 안 해 주면 서비스 전체가 고장 난 줄 알고 화면을 떠납니다.
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

/**
 * 기다리는 동안 자리를 잡아 둡니다.
 *
 * 세 개인 이유: 결과가 3~5개 가변인데(와이어프레임) 가장 적은 수로 두면 결과가
 * 올 때 모달이 늘기만 합니다. 다섯으로 잡았다가 세 개가 오면 줄어들고요.
 */
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
