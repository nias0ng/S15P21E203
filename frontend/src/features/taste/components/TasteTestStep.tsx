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
      {/* break-keep — 없으면 한글이 음절 사이에서 접혀 "향 지 / 도를" 이 됩니다 */}
      <header className="space-y-3 break-keep">
        <p className="text-ink-muted text-caption">취향 테스트</p>
        <h1 className="text-display font-serif font-semibold">
          어떤 향에 마음이 가세요?
        </h1>
        {/* 폭을 묶지 않아 한 줄로 섭니다. 한 문장이라 길어질 일이 없고, 좁은 화면에서만 접힙니다 */}
        <p className="text-ink-muted text-body">
          끌리는 향을 최대 두 개까지 골라주세요. 고른 향에 가장 가까운 향수에서
          향&nbsp;지도를 시작해요.
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
          모서리만 안의 계열 타일과 같은 `rounded-card` 로 맞춥니다.
        */
        <section className={cn(GLASS_PANEL, 'rounded-card space-y-8')}>
          <FamilyPicker value={picks} onChange={setPicks} />

          <div className="border-line-soft flex items-center justify-between gap-6 border-t pt-6">
            {/*
              몇 개 골랐는지는 숫자가 제일 짧게 말합니다. 낭독기에는 숫자만 읽히면
              무엇의 개수인지 알 수 없어 앞에 이름을 숨겨 둡니다.
            */}
            <p
              className="text-caption text-ink font-medium tabular-nums"
              aria-live="polite"
            >
              <span className="sr-only">고른 향 </span>
              {picks.length} / {MAX_PICKS}
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
