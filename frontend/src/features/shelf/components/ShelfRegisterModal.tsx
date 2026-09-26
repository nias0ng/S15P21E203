import { useState } from 'react'

import { useResetOnOpen } from '@/shared/hooks/useResetOnOpen'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { PerfumePicker } from '@/shared/ui/PerfumePicker'

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
   * 모달(`LinkedPerfumeModal`)도 같은 규칙입니다. `preselected` 로 1단계를 건너뛰면 쓰지 않습니다.
   */
  options?: PerfumeOption[]
  onSearch?: (keyword: string) => void
  onSubmit: (input: ShelfRegisterInput) => void
  /**
   * 향수 상세(A10)에서 들어오면 1단계를 건너뛰고 2단계로 바로 갑니다.
   * 그때는 [변경] 줄도 없습니다 (A15 주석).
   */
  preselected?: PerfumeOption
  /** 검색 결과를 기다리는 중. 1단계에만 씁니다 */
  isPending?: boolean
  /**
   * 3D 향 지도 위에 뜨는가 (메인의 부표 카드 [진열대에 저장]). 엔진 카드와 같은 저녁 유리
   * (`scent-map-panel`)를 입고, 폭 · 칸을 줄여 바다를 덜 덮게 섭니다. 단추는 메모 바로
   * 아래로 올라와 구분선 없이 한 장으로 읽힙니다.
   *
   * NOTE: 1단계(향수 고르기)가 없는 자리 — `preselected` 를 넘기는 곳에 씁니다. 좁힌 폭에서는
   * 고르기 격자가 눌립니다.
   */
  scene?: boolean
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
  options = [],
  onSearch,
  onSubmit,
  preselected,
  isPending = false,
  scene = false,
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
   * 열릴 때마다 칸을 처음 값으로 되돌립니다.
   *
   * `Modal` 이 `<dialog>` 라 **닫아도 언마운트되지 않습니다.** 그냥 두면 담기를
   * 취소하고 다시 열었을 때 앞서 고른 향수 · 분류 · 적합도 · 메모가 그대로 남습니다.
   * 향수 상세와 향 지도에서 다른 향수로 들어와도 앞 향수가 골라진 채로 뜹니다.
   *
   * `preselected` 는 매 렌더 새 객체일 수 있어 값으로 비교합니다.
   */
  const openedKey = open ? JSON.stringify(preselected ?? null) : null
  useResetOnOpen(openedKey, () => {
    setPicked(preselected ?? null)
    setCategory(null)
    setRating(null)
    setMemo('')
    setShowMissing(false)
  })

  // 상세에서 들어오면 1단계가 없습니다
  const step: 1 | 2 = picked ? 2 : 1
  const canChangePerfume = !preselected

  const cancelVariant = scene ? 'ghost' : 'outline'
  const submitVariant = scene ? 'navy' : 'primary'
  const actions =
    step === 1 ? (
      <>
        <Button variant={cancelVariant} onClick={onClose}>
          취소
        </Button>
        <Button variant={submitVariant} disabled>
          다음
        </Button>
      </>
    ) : (
      <>
        <Button variant={cancelVariant} onClick={onClose}>
          취소
        </Button>
        <Button
          variant={submitVariant}
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="향수 등록"
      className={scene ? 'scent-map-panel rounded-glass w-100' : undefined}
      initialFocus={scene ? 'panel' : 'first'}
      titleSize={scene ? 'heading' : 'title'}
      footer={scene ? undefined : actions}
    >
      {step === 1 ? (
        <PerfumePicker
          // 이미 진열대에 있으면 고를 수 없습니다
          options={options.map((option) => ({
            id: option.perfumeId,
            name: option.name,
            brand: option.brand,
            thumbnailUrl: option.thumbnailUrl,
            disabled: option.alreadyInShelf,
            disabledLabel: '이미 진열대에 담은 향수입니다',
          }))}
          isPending={isPending}
          onPick={({ id }) =>
            setPicked(options.find((option) => option.perfumeId === id) ?? null)
          }
          onSearch={(keyword) => onSearch?.(keyword)}
        />
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
            compact={scene}
          />
        </div>
      )}
      {scene && (
        <div className="mt-3.75 flex justify-end gap-2.5">{actions}</div>
      )}
    </Modal>
  )
}
