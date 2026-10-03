import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { keywordMatcher } from '@/shared/lib/keywordMatch'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SearchField } from '@/shared/ui/SearchField'

import { CaseBottles, CaseNiche } from './CaseNiche'

/** 컬렉션은 향수가 아니라 진열대 항목을 담습니다 — `perfumeId` 로는 지울 수 없습니다 */
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
  picked: number[]
  onToggle: (shelfItemId: number) => void
  keyword: string
  onKeywordChange: (keyword: string) => void
  /** 후보가 하나도 없을 때 할 말. 만들 때와 담을 때가 다릅니다 */
  emptyTitle: string
  /**
   * 고르는 칸(스크롤 상자)의 윗한도 등 — 기본은 1920 에서 440 입니다. 위에 칸이 더 있는 모달(만들기)은
   * 낮춥니다. 창이 낮으면 모달 본문의 남는 높이만큼 더 줄어듭니다(아래 · COLLECTION_SHEET).
   */
  listClassName?: string
}

/**
 * 진열대에서 향수를 골라 담는 목록 (A19 — COL-01 · COL-03). 검색은 서버에 묻지 않고 받아
 * 둔 후보 안에서 거릅니다 — 목록 API 에 검색어가 없습니다.
 *
 * 후보마다 작은 진열함에 병이 서고, 아래에 브랜드와 이름(두 줄까지)을 적습니다. 오른쪽 위 원이
 * 체크 표시라 여러 병을 고를 수 있다는 것이 처음부터 보입니다 — 고르면 먹으로 차고 진열함에 먹색
 * 테가 돕니다.
 */
export function ShelfItemPickList({
  candidates,
  picked,
  onToggle,
  keyword,
  onKeywordChange,
  emptyTitle,
  listClassName,
}: Props) {
  const { t } = useTranslation('collection')
  const visible = useMemo(() => {
    const matches = keywordMatcher(keyword)
    return candidates.filter((candidate) =>
      matches(candidate.name, candidate.brand),
    )
  }, [candidates, keyword])

  return (
    /*
      모달 본문의 남는 높이를 받아 고르는 칸에 넘깁니다 — 창이 낮으면 검색 · 개수 줄은 그대로 두고
      고르는 칸만 줄어들어(아래 150 까지), 모달이 창보다 길어져 단추가 숨지 않습니다.
    */
    <div className="flex min-h-0 flex-1 flex-col gap-3.75">
      <SearchField
        label={t('pick.searchLabel')}
        placeholder={t('pick.searchPlaceholder')}
        value={keyword}
        onChange={(event) => onKeywordChange(event.target.value)}
        onSearch={onKeywordChange}
      />

      {/* 담을 향수가 없는 것과 검색어에 안 걸린 것은 다음에 할 일이 달라 문구를 나눕니다 */}
      {candidates.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={t('pick.noCandidatesDescription')}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('pick.noMatchTitle')}
          description={t('pick.noMatchDescription')}
        />
      ) : (
        /*
          체크박스 대신 칸 자체가 누르는 자리입니다 — 고른 것은 `aria-pressed` 로 알립니다.
          스크롤 칸은 좌우 · 위로 10 넓히고 안쪽을 같은 만큼 띄웁니다 — 고른 칸의 먹색 테(진열함 밖 4)와
          체크 원(모서리 밖 5 · 그림자)이 칸 끝에 붙으면 스크롤 칸에 잘리거나 가로 막대를 만듭니다.
          아래로는 넓히지 않습니다 — 넓히면 스크롤되는 글이 아래 "N개 선택됨" 줄 밑으로 겹칩니다.
        */
        <ul
          className={cn(
            'collection-pick-list -mx-2.5 -mt-2.5 grid max-h-[calc(var(--spacing)*110)] min-h-[calc(var(--spacing)*37.5)] grid-cols-[repeat(auto-fill,minmax(calc(var(--spacing)*32.5),1fr))] gap-x-3.75 gap-y-5 overflow-y-auto px-2.5 pt-2.5',
            listClassName,
          )}
        >
          {visible.map((candidate) => {
            const isPicked = picked.includes(candidate.shelfItemId)

            return (
              <li key={candidate.shelfItemId} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={isPicked}
                  onClick={() => onToggle(candidate.shelfItemId)}
                  className="collection-case collection-pick block w-full outline-none"
                >
                  <CaseNiche shape="square" compact>
                    <CaseBottles sources={[candidate.thumbnailUrl ?? null]} />
                  </CaseNiche>
                  <span aria-hidden className="collection-pick-check" />
                  {/*
                    긴 영문 브랜드는 좁은 칸에서 말줄임됩니다(진열대 이름표와 같은 규칙) — 마우스를 올리면
                    다 보입니다. 브랜드가 비어 있는 향수도 줄자리는 남겨 이름 줄이 칸마다 같은 높이에 섭니다.
                  */}
                  <span
                    className="collection-pick-brand"
                    title={candidate.brand ?? undefined}
                  >
                    {candidate.brand ?? <span aria-hidden>&nbsp;</span>}
                  </span>
                  <span className="collection-pick-name">{candidate.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* 검색으로 가려진 향수도 고른 채로 셉니다 */}
      <p className="shelf-muted text-body">
        <span className="font-semibold text-[var(--shelf-ink)] tabular-nums">
          {t('pick.selected', { count: picked.length })}
        </span>{' '}
        {t('pick.notOnShelf')}
      </p>
    </div>
  )
}
