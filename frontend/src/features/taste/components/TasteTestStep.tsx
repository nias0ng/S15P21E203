import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { isApiError } from '@/shared/api/http'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
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
   * 결과 모달에서 확인을 눌렀을 때. 뽑힌 향수 id 를 넘기지 않습니다 — 확인을 누를 때
   * 이 컴포넌트가 결과를 남겨(`POST /users/me/taste-test`) **서버가 이미 압니다**.
   */
  onComplete: () => void
}

/**
 * 취향 테스트 온보딩 스텝 (TST-03). 계열을 1~2개 고르면 결과 모달이 뜨고,
 * **건너뛰기는 없습니다.**
 *
 * **첫 로그인 직후에 열립니다** — 로그인 화면이 `GET /users/me/taste-test` 로 아직
 * 치르지 않은 사람을 가려내 보냅니다. 그다음 이동은 부르는 쪽이 정합니다.
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
   * 결과를 서버에 남깁니다 (TST-03). **이미 마친 사람은 409 인데 성공으로 다룹니다** —
   * 막으면 주소로 다시 들어온 사람이 아무 데도 못 갑니다. 저장한 기록은 캐시에
   * 넣어 둡니다(로그인 화면이 온보딩을 띄울지 볼 때 씁니다).
   */
  const save = useMutation({
    mutationFn: (result: TasteMatch) =>
      completeTasteTest({
        picks: result.picks,
        matchedPerfumeId: result.perfumeId,
      }),
    onSuccess: (record) => {
      queryClient.setQueryData(tasteKeys.mine(), record)
      onComplete()
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: tasteKeys.mine() })
        onComplete()
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
          {/* 로딩 자리표시자는 타일과 같은 크기여야 끝나는 순간 레이아웃이 튀지 않습니다 */}
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
        <>
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
        </>
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
