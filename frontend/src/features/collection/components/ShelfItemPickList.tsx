import { useMemo } from 'react'

import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SearchField } from '@/shared/ui/SearchField'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/**
 * 고를 수 있는 진열대 항목 한 줄.
 *
 * **번호가 `shelfItemId` 입니다.** 컬렉션은 향수가 아니라 내 진열대 항목을 담기
 * 때문에, 담고 빼는 요청이 전부 이 번호를 씁니다. `perfumeId` 로는 지울 수 없습니다.
 */
export type ShelfItemCandidate = {
  shelfItemId: number
  perfumeId: number
  name: string
  /** 브랜드가 비어 있는 향수가 있습니다 */
  brand: string | null
  thumbnailUrl?: string | null
}

type Props = {
  candidates: ShelfItemCandidate[]
  /** 고른 진열대 항목 번호들 */
  picked: number[]
  onToggle: (shelfItemId: number) => void
  /** 검색어. 모달이 들고 있다가 닫을 때 비웁니다 */
  keyword: string
  onKeywordChange: (keyword: string) => void
  /** 후보가 하나도 없을 때 할 말. 만들 때와 담을 때가 다릅니다 */
  emptyTitle: string
}

/**
 * 진열대에서 향수를 골라 담는 목록 (와이어프레임 A19 — COL-01 · COL-03)
 *
 * 두 모달이 같은 목록을 씁니다. 컬렉션 만들기와 향수 추가인데, 고르는 대상과
 * 규칙("진열대에 없는 향수는 추가 불가")이 같습니다. 따로 적어 두면 한쪽에만
 * 검색이 붙거나 빈 화면 문구가 달라집니다.
 *
 * 값을 들고 있지 않습니다(controlled) — 고른 뒤에 벌어지는 일이 모달마다 달라서
 * (만들기는 `POST /collections`, 추가는 `POST .../perfumes`) 그 판단은 부르는 쪽에 둡니다.
 *
 * **검색은 서버에 묻지 않고 받아 둔 후보 안에서 거릅니다.** 목록 API 에 검색어
 * 파라미터가 없기도 하지만, 그전에 화면이 이미 진열대를 분류 3개 × 전 페이지
 * 통째로 받아 두기 때문입니다(`features/shelf` 의 `getShelfItems`). 진열대 화면의
 * 검색(`useShelfBrowser`)과 같은 기준(향수명 · 브랜드)으로 겁니다 — 같은 검색어를
 * 쳤는데 진열대와 이 모달의 결과가 다르면 고르다가 헷갈립니다.
 */
export function ShelfItemPickList({
  candidates,
  picked,
  onToggle,
  keyword,
  onKeywordChange,
  emptyTitle,
}: Props) {
  const visible = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    if (!needle) return candidates

    return candidates.filter(
      (candidate) =>
        candidate.name.toLowerCase().includes(needle) ||
        // 브랜드가 비어 있는 향수가 있습니다 — 이름만으로 걸립니다
        (candidate.brand?.toLowerCase().includes(needle) ?? false),
    )
  }, [candidates, keyword])

  return (
    <>
      {/*
        치는 대로 걸러집니다. 검색 단추(submit)는 같은 값을 한 번 더 넘길 뿐이라
        눌러도 결과가 바뀌지 않습니다 — 진열대 화면의 검색창과 같은 동작입니다.
      */}
      <SearchField
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드 검색"
        value={keyword}
        onChange={(event) => onKeywordChange(event.target.value)}
        onSearch={onKeywordChange}
      />

      {/*
        빈 자리가 두 종류입니다. 담을 향수가 아예 없는 것과 검색어에 걸린 게 없는
        것은 다음에 할 일이 달라서(진열대에 담으러 가기 · 검색어 고치기) 문구를
        나눕니다. 하나로 합치면 검색 결과 0건에 "진열대에 저장한 향수만 넣을 수
        있습니다" 가 떠서, 담아 둔 향수가 사라진 줄 압니다.
      */}
      {candidates.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description="진열대에 저장한 향수만 컬렉션에 넣을 수 있습니다."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="조건에 맞는 향수가 없습니다"
          description="다른 향수명이나 브랜드명으로 검색해 보세요."
        />
      ) : (
        /*
          향수를 고르는 나머지 두 모달(`ShelfRegisterModal` 1단계 ·
          `LinkedPerfumeModal`)과 같은 격자입니다 — 한 줄에 넷 · 높이는 360 까지 ·
          넘치면 목록만 스크롤합니다. 셋이 같은 일을 하는데 여기만 한 줄짜리 목록이라,
          같은 화면을 오가며 향수를 고르는 사람이 매번 다른 물건으로 읽었습니다.

          체크박스를 두지 않습니다 — 카드 자체가 누르는 자리이고, 고른 것은 테두리와
          `aria-pressed` 로 알립니다. 카드 안에 네모를 또 두면 사진을 누를지 네모를
          누를지 헷갈립니다.
        */
        <ul className="grid max-h-90 grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-4">
          {visible.map((candidate) => {
            const isPicked = picked.includes(candidate.shelfItemId)

            return (
              <li key={candidate.shelfItemId}>
                <button
                  type="button"
                  aria-pressed={isPicked}
                  onClick={() => onToggle(candidate.shelfItemId)}
                  className={cn(
                    'w-full border p-2.5 text-left',
                    'transition-colors duration-120 ease-out',
                    'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                    isPicked
                      ? 'border-accent bg-line-soft'
                      : 'border-line hover:border-accent',
                  )}
                >
                  {/* 사진이 없는 향수가 있습니다 — 그때는 빈 상자를 그립니다 */}
                  <Thumbnail
                    src={candidate.thumbnailUrl}
                    fallback="이미지"
                    className="text-caption mb-2.5 aspect-3/4 w-full"
                  />
                  <span className="text-ink text-body block truncate font-medium">
                    {candidate.name}
                  </span>
                  <span className="text-ink-muted text-caption block truncate">
                    {candidate.brand}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/*
        검색으로 가려진 향수도 고른 것은 고른 채로 셉니다. 검색어를 바꿀 때마다
        선택이 풀리면, 여러 번 검색해 가며 고르는 일(이 모달의 본래 쓰임)이 됩니다.
      */}
      <p className="text-ink-muted text-caption">
        {picked.length}개 선택됨 · 진열대에 없는 향수는 추가할 수 없습니다.
      </p>
    </>
  )
}
