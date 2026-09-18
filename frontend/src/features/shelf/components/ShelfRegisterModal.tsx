import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { SearchField } from '@/shared/ui/SearchField'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { PerfumeOption, ShelfCategory, ShelfRegisterInput } from '../types'

import { ShelfItemFields } from './ShelfItemFields'

type Props = {
  open: boolean
  onClose: () => void
  /**
   * 1단계에서 고를 후보. 향수 도메인 데이터를 화면(pages)에서 이 모양으로 맞춰 넘깁니다.
   *
   * **검색하기 전에는 빈 배열입니다.** 조건 없이 불러오면 카탈로그의 번호 빠른 앞쪽
   * 스물이 후보로 서는데, 그건 고를 향수가 아니라 그냥 목록입니다. 글에 향수를 거는
   * 모달(`LinkedPerfumeModal`)도 같은 규칙입니다.
   */
  options: PerfumeOption[]
  onSearch: (keyword: string) => void
  onSubmit: (input: ShelfRegisterInput) => void
  /**
   * 향수 상세(A10)에서 들어오면 1단계를 건너뛰고 2단계로 바로 갑니다.
   * 그때는 [변경] 줄도 없습니다 (A15 주석).
   */
  preselected?: PerfumeOption
  /** 검색 결과를 기다리는 중. 1단계에만 씁니다 */
  isPending?: boolean
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
  isPending = false,
}: Props) {
  const [picked, setPicked] = useState<PerfumeOption | null>(null)
  const [category, setCategory] = useState<ShelfCategory | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [memo, setMemo] = useState('')
  /*
   * [담기] 를 눌렀는데 분류가 비어 있었는지. 참이면 분류 칸 옆에 [필수] 가 섭니다.
   *
   * 누르기 전에는 띄우지 않습니다 — 열자마자 빨간 글자가 떠 있으면 아직
   * 아무것도 안 했는데 이미 틀린 것처럼 보입니다.
   */
  const [showMissing, setShowMissing] = useState(false)

  /*
   * 한 번이라도 검색했는지. 후보가 0개인 경우가 둘(아직 안 찾음 · 찾았는데 없음)인데,
   * 둘 다 "찾지 못했습니다" 라고 하면 열자마자 검색에 실패한 것처럼 읽힙니다.
   * 검색어는 화면(`MyShelfPage`)이 들고 있어 여기로 내려오지 않으므로 따로 기억합니다.
   *
   * 아래 "열릴 때마다 되돌리기" 에 넣지 않습니다 — `SearchField` 는 제가 값을 들고
   * 있어 다시 열어도 지난 검색어가 칸에 그대로 남습니다. 거기서 "검색해 주세요" 로
   * 돌아가면 칸의 글자와 안내가 어긋납니다.
   */
  const [searched, setSearched] = useState(false)

  const search = (keyword: string) => {
    setSearched(keyword.trim().length > 0)
    onSearch(keyword)
  }

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
    setShowMissing(false)
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
              /*
               * **꺼 두지 않고 눌리게 둡니다.** 분류가 필수인데 단추를 꺼 버리면
               * 왜 안 눌리는지 알려 줄 자리가 없습니다 — 눌러 보게 하고 모자란
               * 칸 옆에 [필수] 를 띄웁니다.
               *
               * 적합도와 메모는 선택입니다. 아직 맡아 보지 않은 향수를 [보유 희망]
               * 으로 담는 것이 이 모달의 정상적인 쓰임인데, 그때 적합도는 답할 수
               * 없는 질문입니다. 서버도 `POST /users/me/shelf-items` 로는 분류만
               * 받고, 적합도는 따로 보내거나 아예 안 보낼 수 있습니다.
               */
              onClick={() => {
                if (!picked) return
                if (category === null) {
                  setShowMissing(true)
                  return
                }
                onSubmit({
                  perfumeId: picked.perfumeId,
                  category,
                  rating,
                  memo: memo.trim() || null,
                })
              }}
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
            onSearch={search}
          />

          {isPending ? (
            /*
              기다리는 동안 빈 화면을 그리면 "찾지 못했습니다" 가 한 번 스쳤다가
              결과로 바뀝니다 — 찾아보기도 전에 실패했다고 말하는 셈입니다.
              글에 향수를 거는 모달(`LinkedPerfumeModal`)과 같은 자리표시 격자입니다.
            */
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
                searched ? '향수를 찾지 못했습니다' : '향수를 검색해 주세요'
              }
              description={
                searched
                  ? '검색어를 바꿔 보세요.'
                  : '향수명이나 브랜드명을 입력하면 고를 수 있는 향수가 나옵니다.'
              }
            />
          ) : (
            /*
              한 줄에 넷 · 높이는 360 까지. 글에 향수를 거는 모달
              (`LinkedPerfumeModal`)과 같은 값입니다.

              높이를 막지 않았을 때는 검색 결과 20개가 다섯 줄(990)로 그대로 서서, 모달이
              화면 높이를 넘겨 통째로 스크롤됐습니다 — `<dialog>` 의 브라우저 기본값이
              `max-height: calc(100% - 38px)` · `overflow: auto` 라 헤더와 [담기] 단추까지
              같이 밀려 올라갑니다. 목록만 스크롤하게 두면 그 둘은 제자리에 남습니다.
            */
            <ul className="grid max-h-90 grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-4">
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
            categoryMissing={showMissing && category === null}
          />
        </div>
      )}
    </Modal>
  )
}
