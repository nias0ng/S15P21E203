import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { isApiError } from '@/shared/api/http'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Skeleton } from '@/shared/ui/Skeleton'

import { completeTasteTest } from '../api'
import { MAX_PICKS } from '../families'
import { matchStartingPoint } from '../match'
import { scentVectorsQuery, tasteKeys } from '../queries'
import type { ScentFamilyKey, TasteMatch } from '../types'

import { FamilyPicker } from './FamilyPicker'
import { TasteResultModal } from './TasteResultModal'

type TasteTestStepProps = {
  /**
   * 뽑힌 향수 id 를 넘기지 않습니다 — 확인할 때 이 컴포넌트가 남겨 서버가 이미 압니다.
   *
   * @param landed **이번 요청이 배를 그 향수 자리에 놓았는가.** 처음 치르는 사람만 true 입니다.
   * 이미 마친 사람(409)은 서버가 `placeStartingPoint` 까지 **같은 트랜잭션으로 되돌리므로**
   * 배는 마지막 항해 자리에 그대로 있습니다 (`TasteTestService.complete` 주석). 그 차이를
   * 부르는 쪽이 알아야 배를 엉뚱한 자리에 착륙시키지 않습니다.
   */
  onComplete: (landed: boolean) => void
}

/**
 * 취향 테스트 온보딩 스텝 (TST-03). 계열 1~2개를 고르면 결과 모달이 뜨고 건너뛰기는 없습니다.
 * 로그인 화면이 아직 치르지 않은 사람을 가려 보내고, 그다음 이동은 부르는 쪽이 정합니다.
 */
export function TasteTestStep({ onComplete }: TasteTestStepProps) {
  const vectors = useQuery(scentVectorsQuery())
  const queryClient = useQueryClient()

  const [picks, setPicks] = useState<ScentFamilyKey[]>([])
  const [match, setMatch] = useState<TasteMatch | null>(null)

  const handleSubmit = () => {
    if (!vectors.data || picks.length === 0) return
    setMatch(matchStartingPoint(vectors.data, picks))
  }

  /**
   * NOTE: 이미 마친 사람은 409 인데 **넘어가는 것은** 성공으로 다룹니다 — 막으면 주소로 다시
   * 들어온 사람이 아무 데도 못 갑니다. 저장한 기록은 로그인 화면이 보도록 캐시에 넣습니다.
   *
   * NOTE: 다만 `landed` 는 다릅니다. 409 는 배를 놓은 것까지 되돌아가므로 false 입니다.
   */
  const save = useMutation({
    mutationFn: (result: TasteMatch) =>
      completeTasteTest({
        picks: result.picks,
        matchedPerfumeId: result.perfumeId,
      }),
    onSuccess: (record) => {
      queryClient.setQueryData(tasteKeys.mine(), record)
      onComplete(true)
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: tasteKeys.mine() })
        onComplete(false)
      }
    },
  })

  const saveError =
    save.isError && !(isApiError(save.error) && save.error.status === 409)
      ? '결과를 저장하지 못했습니다. 다시 시도해주세요.'
      : null

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-ink-muted text-caption">취향 테스트</p>
        <h1 className="text-display font-serif font-semibold">
          어떤 향에 마음이 가세요?
        </h1>
        <p className="text-ink-muted text-body max-w-165">
          끌리는 향의 인상을 골라주세요. 하나만 골라도 되고, 두 개까지 고를 수
          있어요. 먼저 고른 쪽을 더 크게 반영해 가장 가까운 향수를 찾아드립니다.
        </p>
      </header>

      {vectors.isPending && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {/* 타일과 같은 크기여야 로딩이 끝나는 순간 레이아웃이 튀지 않습니다 */}
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="h-18" />
          ))}
        </div>
      )}

      {vectors.isError && (
        <EmptyState
          title="향 지도 데이터를 불러오지 못했습니다"
          description="다시 시도해주세요."
          action={
            <Button variant="outline" onClick={() => vectors.refetch()}>
              다시 시도
            </Button>
          }
        />
      )}

      {vectors.isSuccess && (
        /*
          계열 고르기와 아래 줄은 유리판 한 장입니다 — 향수 · 브랜드 · 노트와 같은 층
          구조입니다(docs/어두운-방-유리판.md). 머리 구역은 판 없이 어둠에 바로 둡니다.
        */
        <section className={cn(GLASS_PANEL, 'space-y-8')}>
          <FamilyPicker value={picks} onChange={setPicks} />

          <div className="border-line-soft flex items-center justify-between gap-6 border-t pt-6">
            <p className="text-ink-muted text-caption">
              {picks.length === 0 &&
                '아직 고르지 않았어요 · 하나만 골라도 시작할 수 있어요'}
              {picks.length === 1 &&
                '1개 선택 · 하나 더 고르면 먼저 고른 쪽을 더 크게 반영해요'}
              {picks.length >= MAX_PICKS &&
                '2개 선택 · 바꾸려면 고른 것을 먼저 해제해 주세요'}
            </p>
            <Button
              size="lg"
              disabled={picks.length === 0}
              onClick={handleSubmit}
            >
              출발점 찾기
            </Button>
          </div>
        </section>
      )}

      <TasteResultModal
        open={match !== null}
        match={match}
        /* 저장하는 중에는 계열 선택 화면으로 돌아가지 못하게 둡니다 */
        onRetry={() => {
          if (save.isPending) return
          save.reset()
          setMatch(null)
        }}
        onConfirm={() => match && save.mutate(match)}
        saving={save.isPending}
        saveError={saveError}
      />
    </div>
  )
}
