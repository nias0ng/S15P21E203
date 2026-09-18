import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { scentFamilyName } from '@/shared/config/scentFamilies'
import { UNROLL, useUnroll } from '@/shared/hooks/useUnroll'
import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'

import { filterMapPerfumes, MAP_SEARCH_LIMIT } from '../mapPerfumes'
import { mapPerfumesQuery } from '../queries'
import type { MapPerfume } from '../types'

type Props = {
  /** 찾는 말. `null` 이면 닫힌 상태입니다 */
  keyword: string | null
  onClose: () => void
  /** 결과 한 줄을 골랐습니다. 어디로 보낼지는 화면(pages)이 정합니다 */
  onSelect: (perfume: MapPerfume) => void
}

/**
 * 지도에 있는 향수 200개 안에서 찾은 결과 (메인 검색의 **일반 검색** 쪽).
 *
 * 자연어 추천과 **같은 모달 자리**에 뜹니다 — 사람이 보기에 한 검색창이 두 가지
 * 답을 내놓는 것이라, 답이 나오는 자리까지 달라지면 방식을 바꾼 게 아니라 다른
 * 기능을 쓴 것처럼 보입니다. 열리는 움직임(족자)도, 위쪽에 붙여 두는 것(`mt-25`)도
 * 같은 이유로 같습니다 — 자세한 사정은 `RecommendModal` 주석에 있습니다.
 *
 * ⚠️ 이 목록에는 **DB 향수 번호가 없습니다**(fragrantica_id 뿐). 그래서 한 줄을
 * 골랐을 때 향수 상세로 바로 못 가고 이름으로 향수 검색(A09)에 보냅니다 — 엔진
 * 카드의 [자세히 보기]와 같은 사정이고, 같은 길입니다(`ScentScene`).
 */
export function MapSearchModal({ keyword, onClose, onSelect }: Props) {
  return (
    <Modal
      open={keyword !== null}
      onClose={onClose}
      title="지도에서 찾기"
      className="mt-25 mb-auto w-[min(760px,calc(100vw-40px))]"
    >
      {/* 닫혀 있으면 내용을 안 그립니다 — 그래야 다음에 열 때 족자가 다시 풀립니다 */}
      {keyword !== null && (
        <MapSearchBody keyword={keyword} onSelect={onSelect} />
      )}
    </Modal>
  )
}

/** 열릴 때마다 새로 마운트됩니다 */
function MapSearchBody({
  keyword,
  onSelect,
}: {
  keyword: string
  onSelect: (perfume: MapPerfume) => void
}) {
  const { bodyRef, style, inert } = useUnroll()

  /*
   * ⚠️ 모달이 열려 있을 때만 받습니다. 닫힌 채로도 받으면 메인에 들어오기만 해도 엔진
   * 데이터 88KB 를 가져갑니다 — 3D 가 배 모델 8MB 를 받는 그 시간에 끼어들어서,
   * 검색하지 않는 사람에게는 첫 화면만 늦어집니다. (지금은 이 컴포넌트 자체가
   * 열릴 때만 생기므로 그 조건이 마운트로 지켜집니다.)
   */
  const perfumes = useQuery(mapPerfumesQuery())

  // 200개짜리 목록을 훑는 일이라 쿼리로 나누지 않습니다 — 찾는 말이 바뀔 때만 다시 셉니다
  const results = useMemo(
    () =>
      perfumes.data === undefined
        ? []
        : filterMapPerfumes(perfumes.data, keyword),
    [keyword, perfumes.data],
  )

  return (
    // 향해 일지와 같은 족자 — 모달 머리줄이 위 축이고 그 아래가 풀려 내려옵니다
    <div
      className={cn(
        'overflow-hidden transition-[height] motion-reduce:transition-none',
        UNROLL,
      )}
      style={style}
      inert={inert}
    >
      <div ref={bodyRef}>
        <p className="text-ink-muted mb-3.75 text-[11px]">
          찾는 말 ·{' '}
          <strong className="text-ink font-medium">
            &lsquo;{keyword}&rsquo;
          </strong>
          {results.length > 0 && (
            <>
              {' '}
              · {results.length}개
              {results.length === MAP_SEARCH_LIMIT && ' 까지'}
            </>
          )}
        </p>

        {perfumes.isPending && (
          <ul className="space-y-2.5">
            {[0, 1, 2].map((row) => (
              <li key={row}>
                <Skeleton className="h-15 w-full" />
              </li>
            ))}
          </ul>
        )}

        {perfumes.isError && (
          <EmptyState
            title="지도 향수 목록을 불러오지 못했습니다"
            description="잠시 후 다시 시도해 주세요."
          />
        )}

        {perfumes.isSuccess &&
          (results.length === 0 ? (
            <EmptyState
              title="지도에 그런 향수가 없습니다"
              description="지도에는 향수 200개만 떠 있습니다. 브랜드 이름으로 다시 찾아보거나, 검색 방식을 자연어로 바꿔 보세요."
            />
          ) : (
            <ul className="max-h-127.5 space-y-2.5 overflow-y-auto pr-1.25">
              {results.map((perfume) => (
                <li key={perfume.fragranticaId}>
                  <button
                    type="button"
                    onClick={() => onSelect(perfume)}
                    className="border-line bg-surface-card hover:border-ink flex w-full items-center gap-3.75 border p-2.5 text-left transition-colors duration-120"
                  >
                    {/* 지도 순위 — 이 목록의 차례가 곧 화해 기준 순위입니다 */}
                    <span className="bg-ink text-surface flex size-6.25 shrink-0 items-center justify-center text-[11px]">
                      {perfume.rank}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="text-ink block truncate text-xs font-bold">
                        {perfume.name}
                      </span>
                      <span className="text-ink-muted block truncate text-[10.5px]">
                        {perfume.brand}
                        {/*
                          한글 이름으로 찾았어도 영문 원명을 함께 둡니다 — 같은 향수를
                          브랜드마다 다르게 옮겨 적어서, 원명이 있어야 내가 아는 그
                          향수가 맞는지 확인이 됩니다
                        */}
                        {perfume.nameEn !== perfume.name && (
                          <> · {perfume.nameEn}</>
                        )}
                      </span>
                    </span>

                    {perfume.family && (
                      <span className="border-line text-ink-muted shrink-0 border px-2 py-1 text-[10.5px]">
                        {scentFamilyName(perfume.family)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  )
}
