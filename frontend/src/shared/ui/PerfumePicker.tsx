import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SearchField } from '@/shared/ui/SearchField'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/** 고를 후보 한 병. 도메인 타입을 받지 않아 부르는 쪽이 이 모양으로 맞춰 넘깁니다 */
export type PerfumePickerOption = {
  id: number
  name: string
  /** 브랜드가 없는 향수는 null 이라 빈 줄로 둡니다 */
  brand?: string | null
  /** 사진이 없는 향수가 많습니다. 그때는 빈 상자를 그립니다 */
  thumbnailUrl?: string | null
  /** 참이면 흐리게 두고 누를 수 없게 합니다 */
  disabled?: boolean
  /**
   * 꺼진 까닭. 낭독기에만 `이름 · 까닭` 으로 읽힙니다 — 눈으로는 흐려진 카드로 충분하지만
   * 낭독기에는 그 흐림이 전해지지 않습니다.
   */
  disabledLabel?: string
}

type PerfumePickerProps = {
  options: PerfumePickerOption[]
  /** 검색 결과를 기다리는 중 */
  isPending: boolean
  /** 넘기면 카드가 누름 단추(`aria-pressed`)가 되고 고른 카드가 강조됩니다 */
  isSelected?: (id: number) => boolean
  onPick: (option: PerfumePickerOption) => void
  onSearch: (keyword: string) => void
  className?: string
}

/**
 * 향수를 검색해 고르는 칸 (C02 · A15). 검색창 · 기다리는 동안의 자리표시 격자 · 두 가지
 * 빈 안내 · 카드 격자를 한 벌로 둡니다. 고른 것을 들고 있는 일은 부르는 쪽이 합니다.
 *
 * NOTE: 검색했는지는 여기서 기억합니다. 후보 0개가 두 경우(아직 안 찾음 · 찾았는데 없음)인데,
 * 둘 다 "찾지 못했습니다" 라고 하면 열자마자 검색에 실패한 것처럼 읽힙니다. 모달이
 * `<dialog>` 라 닫아도 언마운트되지 않고, 검색창도 지난 검색어를 그대로 들고 있어 되돌리지 않습니다.
 *
 * @param props.options 고를 후보. 검색하기 전에는 빈 배열로 넘깁니다
 * @param props.isSelected 고른 후보인지. 넘기지 않으면 누름 상태를 알리지 않습니다
 * @param props.onPick 카드를 누르면 그 후보로 부릅니다
 * @param props.onSearch 검색창에서 검색하면 그 말로 부릅니다
 * @returns 검색창과 후보 격자
 */
export function PerfumePicker({
  options,
  isPending,
  isSelected,
  onPick,
  onSearch,
  className,
}: PerfumePickerProps) {
  const [searched, setSearched] = useState(false)

  const search = (keyword: string) => {
    setSearched(keyword.trim().length > 0)
    onSearch(keyword)
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      <SearchField
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드 검색"
        onSearch={search}
      />

      {isPending ? (
        /* 기다리는 동안 빈 화면을 그리면 "찾지 못했습니다" 가 한 번 스쳤다가 결과로 바뀝니다 */
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index}>
              <Skeleton className="aspect-[1/1.35] w-full" />
            </li>
          ))}
        </ul>
      ) : options.length === 0 ? (
        <EmptyState
          title={searched ? '향수를 찾지 못했습니다' : '향수를 검색해 주세요'}
          description={
            searched
              ? '검색어를 바꿔 보세요.'
              : '향수명이나 브랜드명을 입력하면 고를 수 있는 향수가 나옵니다.'
          }
        />
      ) : (
        /*
          높이를 360 까지로 막습니다. 안 막으면 검색 결과 20개가 다섯 줄로 서서 모달이 화면
          높이를 넘기고, `<dialog>` 가 통째로 스크롤되며 헤더와 단추까지 밀려 올라갑니다.
        */
        <ul className="grid max-h-90 grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-4">
          {options.map((option) => {
            const selected = isSelected?.(option.id) ?? false

            return (
              <li key={option.id}>
                <button
                  type="button"
                  disabled={option.disabled}
                  aria-pressed={isSelected ? selected : undefined}
                  aria-label={
                    option.disabled && option.disabledLabel
                      ? `${option.name} · ${option.disabledLabel}`
                      : undefined
                  }
                  onClick={() => onPick(option)}
                  className={cn(
                    'w-full border p-2.5 text-left',
                    'transition-colors duration-120 ease-out',
                    'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                    selected
                      ? 'border-accent bg-line-soft'
                      : option.disabled
                        ? 'border-line bg-line-soft cursor-not-allowed opacity-60'
                        : 'border-line hover:border-accent',
                  )}
                >
                  <Thumbnail
                    src={option.thumbnailUrl}
                    fallback="이미지"
                    className="text-caption mb-2.5 aspect-3/4 w-full"
                  />
                  <span className="text-ink text-body block truncate font-medium">
                    {option.name}
                  </span>
                  <span className="text-ink-muted text-caption block truncate">
                    {option.brand}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
