import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'

import { MAX_PICKS } from '../families'
import { matchStartingPoint } from '../match'
import { scentVectorsQuery } from '../queries'
import type { ScentFamilyKey, TasteMatch } from '../types'

import { FamilyPicker } from './FamilyPicker'
import { TasteResultModal } from './TasteResultModal'

type TasteTestStepProps = {
  /**
   * 결과 모달에서 확인을 눌렀을 때. 화면 이동은 pages 쪽에서 합니다.
   *
   * ⚠️ 뽑힌 향수 id 를 넘기지 않습니다. 취향 테스트는 향 지도 시드 200개
   * (`fragrantica_id`)로 계산하는데 지도 화면의 자리표시자 포인트는 id 체계가 달라,
   * 지금 넘겨도 마커를 찍을 수 없습니다. 향 지도 API 가 붙어 id 가 하나로 합쳐지면
   * `TasteMatch` 를 그대로 넘기면 됩니다.
   */
  onComplete: () => void
}

/**
 * 취향 테스트 온보딩 스텝 (TST-03)
 *
 * 계열을 1~2개 고르고 [출발점 찾기] 를 누르면 결과 모달이 이 화면 위에 뜹니다.
 * 확인을 눌러야 향 지도로 넘어가고, 다시 하기를 누르면 모달만 닫힙니다.
 * **건너뛰기는 없습니다.**
 *
 * 지금은 독립 라우트(`ROUTES.TASTE_TEST`)로 열립니다. 백엔드가 붙어 회원가입이
 * 동작하면 가입 직후 온보딩 스텝으로 옮길 수 있도록, 화면 이동을 이 컴포넌트가 아니라
 * 호출하는 쪽에 맡겨 두었습니다.
 */
export function TasteTestStep({ onComplete }: TasteTestStepProps) {
  const vectors = useQuery(scentVectorsQuery())

  const [picks, setPicks] = useState<ScentFamilyKey[]>([])
  const [match, setMatch] = useState<TasteMatch | null>(null)

  const handleSubmit = () => {
    if (!vectors.data || picks.length === 0) return
    setMatch(matchStartingPoint(vectors.data, picks))
  }

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
        onRetry={() => setMatch(null)}
        onConfirm={onComplete}
      />
    </div>
  )
}
