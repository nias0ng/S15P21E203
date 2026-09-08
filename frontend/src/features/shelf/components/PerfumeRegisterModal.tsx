import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { SearchField } from '@/shared/ui/SearchField'
import { StarRating } from '@/shared/ui/StarRating'
import { Textarea } from '@/shared/ui/Textarea'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import {
  SHELF_CATEGORIES,
  type PerfumeOption,
  type ShelfCategory,
  type ShelfRegisterInput,
} from '../types'

type Props = {
  open: boolean
  onClose: () => void
  /**
   * 1단계에서 고를 후보. 검색 전에는 최근 본 향수를 넣어주세요 (A15 주석).
   * 향수 도메인 데이터를 화면(pages)에서 이 모양으로 맞춰 넘깁니다.
   */
  options: PerfumeOption[]
  onSearch: (keyword: string) => void
  onSubmit: (input: ShelfRegisterInput) => void
  /**
   * 향수 상세(A10)에서 들어오면 1단계를 건너뛰고 2단계로 바로 갑니다.
   * 그때는 [변경] 줄도 없습니다 (A15 주석).
   */
  preselected?: PerfumeOption
}

/**
 * 향수 등록 모달 2단계 (와이어프레임 A15 — SHF-01 · SHF-08 · SHF-10 · DTL-18 · DTL-19)
 *
 * 1단계 향수 고르기 → 2단계 등록 정보 입력.
 * 와이어프레임 주석을 그대로 지켰습니다.
 * - A13 [+ 향수 등록]에서만 1단계가 뜬다. 향수 상세에서 담을 때는 2단계로 바로 간다
 * - 한 번에 한 개만 고른다 (2단계 입력이 향수 한 개 기준)
 * - 이미 진열대에 있는 향수는 담김 표시 · 선택 불가
 * - 적합도와 메모는 선택. 분류만 고르면 담긴다
 * - 메모는 향수 한 개당 하나 — 시향 기록(SHF-08 · SHF-10)이 이 모달로 흡수됐다
 */
export function PerfumeRegisterModal({
  open,
  onClose,
  options,
  onSearch,
  onSubmit,
  preselected,
}: Props) {
  const [picked, setPicked] = useState<PerfumeOption | null>(
    preselected ?? null,
  )
  const [category, setCategory] = useState<ShelfCategory | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [memo, setMemo] = useState('')

  // 상세에서 들어오면 1단계가 없습니다
  const step: 1 | 2 = picked ? 2 : 1
  const canChangePerfume = !preselected

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="향수 등록"
      footer={
        step === 1 ? (
          <>
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button disabled>다음</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button
              // 분류만 고르면 담깁니다
              disabled={category === null}
              onClick={() =>
                picked &&
                category &&
                onSubmit({
                  perfumeId: picked.perfumeId,
                  category,
                  rating,
                  memo: memo.trim() || null,
                })
              }
            >
              진열대에 담기
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-3">
          <SearchField
            label="향수명 또는 브랜드명으로 검색"
            placeholder="향수명 · 브랜드 검색"
            onSearch={onSearch}
          />

          {options.length === 0 ? (
            <EmptyState
              title="향수를 찾지 못했습니다"
              description="검색어를 바꿔 보세요."
            />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options.map((option) => (
                <li key={option.perfumeId}>
                  <button
                    type="button"
                    // 이미 진열대에 있으면 선택할 수 없습니다
                    disabled={option.alreadyInShelf}
                    onClick={() => setPicked(option)}
                    className={cn(
                      'border-line w-full border p-2 text-left transition-colors',
                      option.alreadyInShelf
                        ? 'bg-line-soft cursor-not-allowed opacity-60'
                        : 'hover:border-slate',
                    )}
                  >
                    <Thumbnail
                      fallback={option.alreadyInShelf ? '담김' : '이미지'}
                      className="mb-1.5 h-16 w-full text-[10px]"
                    />
                    <span className="text-ink block truncate text-[11px] font-bold">
                      {option.name}
                    </span>
                    <span className="text-ink-muted block truncate text-[10px]">
                      {option.brand}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-ink text-xs font-bold">{picked?.name}</span>
            <span className="text-ink-muted text-[10.5px]">
              {picked?.brand}
            </span>
            {canChangePerfume && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => setPicked(null)}
              >
                변경
              </Button>
            )}
          </div>

          <ChipToggle
            label="진열대 분류"
            options={SHELF_CATEGORIES}
            value={category}
            onChange={setCategory}
          />

          <div className="flex items-center gap-3">
            <span className="text-ink-muted text-[10.5px]">내 취향 적합도</span>
            <StarRating
              label="내 취향 적합도"
              value={rating}
              onChange={setRating}
            />
          </div>

          <Textarea
            label="메모"
            hideLabel
            placeholder="메모"
            rows={5}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />

          <p className="text-ink-muted text-[10.5px] leading-relaxed">
            적합도와 메모는 선택입니다. 분류만 고르면 담깁니다. 메모는 향수 한
            개당 하나이고 진열대에서 수정할 수 있습니다.
          </p>
        </div>
      )}
    </Modal>
  )
}
