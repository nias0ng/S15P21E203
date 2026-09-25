import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { scentFamilyName } from '@/shared/config/scentFamilies'
import { Badge } from '@/shared/ui/Badge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Unroll } from '@/shared/ui/Unroll'

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
      /*
        배경을 눌러도 닫지 않습니다. 판이 3D 바다 위에 떠 있어 배경이 화면의 대부분이고,
        결과를 훑다 옆을 잘못 누르면 찾은 목록이 통째로 사라집니다 (`RecommendModal` 과 같습니다).
      */
      closeOnBackdrop={false}
      /*
        판의 재질과 모서리는 **추천 결과 모달과 한 벌입니다**. 같은 검색창에서 갈래만 바꿔
        부른 화면이라, 하나는 바다 위 어두운 유리이고 하나는 상아색 종이면 사람이 보기에
        다른 기능이 끼어든 것으로 읽힙니다.

        ⚠⚠ **판은 굴리지 않습니다(`overflow-hidden`)** — 굴러가는 것은 아래 향수 목록 하나뿐입니다.
        목록이 제 안에서 잘 굴러도(`max-h-127.5`) **가려진 항목이 판의 `scrollHeight` 에 그대로
        얹혀서**, 판은 보이는 높이가 515 인데 `scrollHeight` 를 751 로 셉니다 (2026-09-23 실측).
        그래서 막대가 하나 더 서고, 끌어내리면 내용이 아닌 **빈 자리**가 드러납니다.
        ⚠ 클래스를 빼는 것만으로는 안 막힙니다 — `<dialog>` 는 **브라우저 기본 스타일에
        `overflow: auto`** 가 있어 아무것도 안 적으면 그 값이 섭니다. 못 박아야 합니다.
        ⚠ `hidden` 이 아니라 `clip` 입니다. `hidden` 은 막대만 감추고 **굴림 상자로는 남아**,
        목록 아래쪽 항목으로 Tab 해 들어가면 브라우저가 그것을 보이려고 판을 빈 자리로
        밀어 올립니다 (실측 : `hidden` 에서도 238px 밀림). `clip` 은 굴림 상자가 아예 아닙니다.
        추천 결과 모달은 안쪽에 굴림 상자가 없어 이 사정이 없습니다.

        NOTE: 폭은 760(=190×4) 입니다. 추천 결과(560)에 맞춰 줄이면 순위 배지와 이름 · 브랜드가
        한 줄에 서는 이 목록에서 이름이 먼저 잘립니다(순위는 세 자리까지 갑니다).
        좁은 창의 상한은 `Modal` 의 `max-w` 가 이미 같은 값으로 잡습니다.
      */
      className="scent-map-panel rounded-glass mt-25 mb-auto w-190 overflow-clip"
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
    <Unroll>
      <p className="text-ink-muted text-caption mb-3.75">
        찾는 말 ·{' '}
        <strong className="text-ink font-medium">
          &lsquo;{keyword}&rsquo;
        </strong>
        {results.length > 0 && (
          <>
            {' '}
            · {results.length}개{results.length === MAP_SEARCH_LIMIT && ' 까지'}
          </>
        )}
      </p>

      {perfumes.isPending && (
        <ul className="space-y-3.75">
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
          /*
              줄 사이 15 · 줄 안쪽 15 — 화면의 여백 격자(바깥 240 : 판 안쪽 30 : 항목 사이 15)를 따릅니다.

              NOTE: `scent-thin-scroll` 은 막대를 판 안쪽에 얇게 답니다(`styles/scent-display.css`).
              어두운 유리 위에 브라우저 기본 막대가 서면 회색 트랙과 화살표 단추가 판의 오른쪽
              테두리처럼 읽혀 모서리가 두 겹으로 보입니다.
            */
          <ul className="scent-thin-scroll max-h-127.5 space-y-3.75 overflow-y-auto pr-1.25">
            {results.map((perfume) => (
              <li key={perfume.fragranticaId}>
                <button
                  type="button"
                  onClick={() => onSelect(perfume)}
                  className="border-line bg-surface-card hover:border-ink flex w-full items-center gap-3.75 border p-3.75 text-left transition-colors duration-120"
                >
                  {/*
                      지도 순위 — 이 목록의 차례가 곧 화해 기준 순위입니다.

                      ⚠️ 정사각형(size-6.25)이 아니라 **최소 너비 + 좌우 여백**입니다. 순위는
                      1 부터 200 까지라 자릿수가 셋까지 가는데, 25px 정사각에 11px 로 적으면
                      세 자리가 상자에 꽉 차 글자가 테두리에 붙었습니다(실측 100 · 136 · 157).
                      ⚠️ 무슨 수인지 글자로도 말합니다 — 칠한 숫자만으로는 화면 낭독기에서
                      이름과 구분되지 않습니다
                    */}
                  <span className="bg-ink text-surface text-caption flex h-6.25 min-w-6.25 shrink-0 items-center justify-center rounded-full px-1.5">
                    <span className="sr-only">지도 순위 </span>
                    {perfume.rank}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="text-ink text-body block truncate font-bold">
                      {perfume.name}
                    </span>
                    <span className="text-ink-muted text-caption block truncate">
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

                  {/* 지도 카드(A02)의 향 계열 배지와 **같은 것**입니다 — 같은 값을 두 곳에서 다르게 그리지 않습니다 */}
                  {perfume.family && (
                    <Badge tone="outline" className="shrink-0">
                      {scentFamilyName(perfume.family)}
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </Unroll>
  )
}
