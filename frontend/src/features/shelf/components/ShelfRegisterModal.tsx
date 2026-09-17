import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { SearchField } from '@/shared/ui/SearchField'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { PerfumeOption, ShelfCategory, ShelfRegisterInput } from '../types'

import { ShelfItemFields } from './ShelfItemFields'

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
 * 진열대 등록 모달 2단계 (와이어프레임 A15 — SHF-01 · SHF-08 · SHF-10 · DTL-18 · DTL-19)
 *
 * 1단계 향수 고르기 → 2단계 등록 정보 입력. 한 번에 한 개만 고릅니다.
 *
 * **진열대에 담는 세 입구가 모두 이 모달을 씁니다** — 진열대 화면의 [+ 향수 등록],
 * 향수 상세와 향 지도 카드의 [진열대에 저장]. 뒤 둘은 어떤 향수인지 이미 알고 있어
 * `preselected` 로 1단계를 건너뜁니다. 분류만 고르는 빠른 저장 모달이 따로 있었는데,
 * 같은 "담기" 인데 입구에 따라 적을 수 있는 값이 달라 지웠습니다.
 */
export function ShelfRegisterModal({
  open,
  onClose,
  options,
  onSearch,
  onSubmit,
  preselected,
}: Props) {
  const [picked, setPicked] = useState<PerfumeOption | null>(null)
  const [category, setCategory] = useState<ShelfCategory | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [memo, setMemo] = useState('')

  /*
   * 열릴 때마다 칸을 처음 값으로 되돌립니다.
   *
   * `Modal` 이 `<dialog>` 라 **닫아도 언마운트되지 않습니다.** 그냥 두면 담기를
   * 취소하고 다시 열었을 때 앞서 고른 향수 · 분류 · 적합도 · 메모가 그대로 남습니다.
   * 향수 상세와 향 지도에서 다른 향수로 들어와도 앞 향수가 골라진 채로 뜹니다.
   *
   * `useEffect` 가 아니라 렌더 중에 맞추는 이유: 한 박자 늦게 맞추면 첫 프레임에
   * 옛 값이 보입니다. `preselected` 는 매 렌더 새 객체일 수 있어 값으로 비교합니다.
   */
  const openedKey = open ? JSON.stringify(preselected ?? null) : null
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  if (openedKey !== openedFor) {
    setOpenedFor(openedKey)
    setPicked(preselected ?? null)
    setCategory(null)
    setRating(null)
    setMemo('')
  }

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
        <div className="space-y-2.5">
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
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {options.map((option) => (
                <li key={option.perfumeId}>
                  <button
                    type="button"
                    // 이미 진열대에 있으면 선택할 수 없습니다
                    disabled={option.alreadyInShelf}
                    /*
                      꺼진 이유는 **낭독기에만** 남깁니다. 눈으로는 흐려진 카드로
                      충분하지만, 낭독기에는 그 흐림이 전해지지 않아 "왜 안 눌리는
                      단추인지" 를 알 길이 없습니다.
                    */
                    aria-label={
                      option.alreadyInShelf
                        ? `${option.name} · 이미 진열대에 담은 향수입니다`
                        : undefined
                    }
                    onClick={() => setPicked(option)}
                    className={cn(
                      'border-line w-full border p-2.5 text-left transition-colors duration-120 ease-out',
                      option.alreadyInShelf
                        ? 'bg-line-soft cursor-not-allowed opacity-60'
                        : 'hover:border-accent',
                    )}
                  >
                    {/* 사진이 없는 향수가 많습니다 — 그때는 빈 상자를 그립니다 */}
                    <Thumbnail
                      src={option.thumbnailUrl}
                      fallback="이미지"
                      className="text-caption mb-2.5 h-16.25 w-full"
                    />
                    <span className="text-ink text-body block truncate font-medium">
                      {option.name}
                    </span>
                    <span className="text-ink-muted text-caption block truncate">
                      {option.brand}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-ink text-body font-medium">
              {picked?.name}
            </span>
            <span className="text-ink-muted text-caption">{picked?.brand}</span>
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

          <ShelfItemFields
            category={category}
            onCategoryChange={setCategory}
            rating={rating}
            onRatingChange={setRating}
            memo={memo}
            onMemoChange={setMemo}
            hint="적합도와 메모는 선택입니다. 분류만 고르면 담깁니다. 메모는 향수 한 개당 하나이고 진열대에서 수정할 수 있습니다."
          />
        </div>
      )}
    </Modal>
  )
}
