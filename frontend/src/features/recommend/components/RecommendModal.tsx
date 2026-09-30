import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { isApiError } from '@/shared/api/http'
import { useLocale } from '@/shared/store/localeStore'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Unroll } from '@/shared/ui/Unroll'

import { conditionLabel } from '../nlrReason'
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
  const { t } = useTranslation('recommend')
  return (
    <Modal
      open={query !== null}
      onClose={onClose}
      title={t('nlr.title')}
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
      {query !== null && <RecommendBody query={query} />}
    </Modal>
  )
}

/** 열릴 때마다 새로 마운트됩니다 — 그래야 족자가 매번 처음부터 풀립니다 */
function RecommendBody({ query }: { query: string }) {
  const { t } = useTranslation('recommend')
  const locale = useLocale()
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
        {t('nlr.asked')}
        <strong className="text-ink font-medium">&lsquo;{query}&rsquo;</strong>
      </p>
      {/*
        추천 AI 는 한국어 문장을 기준으로 읽습니다. 영어 화면에서 영어로 적은 사람이 결과가 헐거운
        까닭을 알 수 있게 한 줄 남깁니다.
      */}
      {locale === 'en' && (
        <p className="text-ink-muted text-caption -mt-2.5 mb-3.75">
          {t('nlr.koreanHint')}
        </p>
      )}

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
              {t('nlr.narrowedBefore')}
              <strong className="text-ink font-medium">
                {matchedData
                  .map((data) => conditionLabel(data.label))
                  .join(' · ')}
              </strong>
              {t('nlr.narrowedAfter')}
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
                  t('nlr.relaxedWithoutScent')
                : t('nlr.relaxed')}
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
          ) : (
            /*
                NOTE: 0개인 두 경우를 한 문장으로 묶지 않습니다 — 조건을 못 뽑은 사람에게
                없는 것은 향수가 아니라 알아들은 조건입니다. 인기 향수로 대신하지도 않습니다.
              */
            <EmptyState
              title={
                result.data.status === 'NO_CONDITION'
                  ? t('nlr.empty.noConditionTitle')
                  : t('nlr.empty.noResultTitle')
              }
              description={
                result.data.status === 'NO_CONDITION'
                  ? t('nlr.empty.noConditionDescription')
                  : t('nlr.empty.noResultDescription')
              }
            />
          )}
        </>
      )}
    </Unroll>
  )
}

/**
 * 429 는 기다리면 풀리지만 503 은 추천 서버가 죽은 것이고 그 사이 다른 기능은 멀쩡해서,
 * 둘을 "잠시 후 다시" 로 묶으면 안 됩니다.
 */
function RecommendError({ error }: { error: unknown }) {
  const { t } = useTranslation('recommend')
  const status = isApiError(error) ? error.status : null

  if (status === 429) {
    return (
      <EmptyState
        title={t('nlr.error.rateLimitedTitle')}
        description={t('nlr.error.rateLimitedDescription')}
      />
    )
  }

  if (status === 503) {
    return (
      <EmptyState
        title={t('nlr.error.unavailableTitle')}
        description={t('nlr.error.unavailableDescription')}
      />
    )
  }

  return (
    <EmptyState
      title={t('nlr.error.failedTitle')}
      description={t('nlr.error.failedDescription')}
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
