import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SearchField } from '@/shared/ui/SearchField'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

export type PerfumePickerOption = {
  id: number
  name: string
  brand?: string | null
  thumbnailUrl?: string | null
  disabled?: boolean
  disabledLabel?: string
}

type PerfumePickerProps = {
  options: PerfumePickerOption[]
  isPending: boolean
  isSelected?: (id: number) => boolean
  onPick: (option: PerfumePickerOption) => void
  onSearch: (keyword: string) => void
  className?: string
}

/**
 * 향수를 검색해 고르는 칸 (C02 · A15). 검색창 · 기다리는 동안의 자리표시 격자 · 두 가지
 * 빈 안내 · 카드 격자를 한 벌로 둡니다. 고른 것을 들고 있는 일은 부르는 쪽이 합니다.
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
  const { t } = useTranslation(['layout', 'common'])
  const [searched, setSearched] = useState(false)

  const search = (keyword: string) => {
    setSearched(keyword.trim().length > 0)
    onSearch(keyword)
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      <SearchField
        label={t('perfumePicker.searchLabel')}
        placeholder={t('perfumePicker.placeholder')}
        onSearch={search}
      />

      {isPending ? (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index}>
              <Skeleton className="aspect-[1/1.35] w-full" />
            </li>
          ))}
        </ul>
      ) : options.length === 0 ? (
        <EmptyState
          title={
            searched
              ? t('perfumePicker.notFoundTitle')
              : t('perfumePicker.emptyTitle')
          }
          description={
            searched
              ? t('perfumePicker.notFoundDescription')
              : t('perfumePicker.emptyDescription')
          }
        />
      ) : (
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
                    fallback={t('common:image')}
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
