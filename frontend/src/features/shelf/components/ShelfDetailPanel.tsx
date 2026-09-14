import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Textarea'

import { formatShelfDate } from '../lib'
import type { ShelfItem } from '../types'

type Props = {
  item: ShelfItem | null
  onSetRepresentative: () => void
  onChangeCategory: () => void
  /** 되돌릴 수 없어서 확인창은 화면(pages)이 띄웁니다 */
  onRemove: () => void
  onSaveMemo: (memo: string) => void
  className?: string
}

/*
 * ⚠️ 이 파일은 @theme 토큰 대신 `../shelf-display.css` 의 진열대 전용 색을 씁니다.
 * 이유는 그 파일 머리말에 있습니다. 시안이 확정되면 그 색들을 @theme 으로 올리고
 * 여기 var() 를 토큰으로 바꿉니다.
 */

/**
 * 카드 껍데기.
 *
 * ⚠️ **이 카드 높이가 화면 구성을 좌우합니다.** 안쪽 무엇이든 키우면 하단 띠가
 * 화면 밖으로 밀립니다. 바꿀 때는 `main section` 높이를 재세요. 상한 830px.
 *
 * 최소 높이를 두 상태가 함께 쓰는 이유: 선택 전후로 카드 크기가 바뀌면 병을
 * 누를 때마다 옆 진열장까지 흔들립니다.
 */
const CARD = 'shelf-panel rounded-[14px] px-6 pt-5 pb-3 min-h-[501px]'

/** 포커스 링. ring-offset 기본색이 흰색이라 크림 카드 위에서 흰 줄로 떠 보입니다 */
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper-soft)]'

/**
 * 향조 3단(탑·미들·베이스).
 *
 * ⚠️ 향조는 별도 엔드포인트라 고정값입니다. 백엔드가 붙으면 props 로 받습니다.
 * 시안의 향 재료 사진이 없어 색으로 대신합니다 — 빈 원이면 셋이 똑같아 보입니다.
 */
const SCENT_NOTES = [
  { stage: 'TOP', name: '오렌지', tone: 'shelf-note-citrus' },
  { stage: 'MIDDLE', name: '로즈', tone: 'shelf-note-floral' },
  { stage: 'BASE', name: '패츌리', tone: 'shelf-note-wood' },
] as const

/**
 * 컬렉션 상세 패널 (와이어프레임 A13 우측 — 진열장 시안)
 *
 * 카드 폭은 정하지 않습니다 — 진열장과 나란히 놓이는 자리라 화면(pages)이 정합니다.
 */
export function ShelfDetailPanel({
  item,
  onSetRepresentative,
  onChangeCategory,
  onRemove,
  onSaveMemo,
  className,
}: Props) {
  if (!item) {
    return (
      <aside
        aria-label="선택한 향수 정보"
        className={cn(CARD, 'flex items-center justify-center', className)}
      >
        <p className={cn('shelf-muted text-caption text-center')}>
          진열대에서 향수를 선택하면 여기에 정보가 표시됩니다
        </p>
      </aside>
    )
  }

  return (
    <aside
      aria-label="선택한 향수 정보"
      className={cn(CARD, 'flex flex-col gap-2', className)}
    >
      {/*
        병 이미지는 배경이 투명한 PNG 라 Thumbnail 을 쓰지 않습니다 — 자리표시자
        상자의 테두리·배경이 투명 영역을 네모로 드러내 병이 상자에 든 것처럼 보입니다.
        높이는 시안 180px 을 100px 로 줄였습니다. 시안에 없던 조작이 아래에 들어오면서
        한 화면에 담으려면 어딘가를 줄여야 했고, 사진은 줄여도 알아볼 수 있지만
        조작은 줄이면 못 누릅니다. 이미지가 없을 때도 같은 높이를 비워 둬야 아래 글이
        위아래로 튀지 않습니다.
      */}
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="shelf-bottle-img h-[100px] w-full object-contain"
        />
      ) : (
        <div aria-hidden className="h-[100px]" />
      )}

      <div className="flex flex-col items-center gap-1">
        {/* 시안의 브랜드명은 자간 넓은 대문자입니다. 한글 브랜드는 uppercase 가 무시됩니다 */}
        <p className="shelf-label">{item.brand}</p>

        {/*
          heading 태그가 아닌 이유: 놓이는 자리에 따라 제목 단계가 달라집니다.
          ⚠️ 시안의 국문명 줄은 ShelfItem 에 필드가 없어 생략했습니다 (nameKo 대기).
        */}
        <p className="text-title text-center font-serif leading-tight font-semibold">
          {item.name}
        </p>
      </div>

      {/*
        ⚠️ 백엔드에 향수별 한 줄 소개가 없어 고정 문구입니다.
        <br /> 대신 text-balance 로 두 줄을 맞춥니다 — 실제 문구가 들어오면 길이가
        달라져 엉뚱한 자리에서 끊깁니다.
      */}
      <p className="text-body text-center font-serif text-balance">
        “자유롭고 당당한, 지금의 나를 닮은 향.”
      </p>

      <div className="flex flex-col items-center gap-2">
        <p className="shelf-label">Scent Note</p>

        {/*
          flex 가 아니라 3열 그리드입니다. flex 면 이름 길이에 따라 칸이 서로 달라져
          원 세 개가 가운데 정렬에서 어긋납니다.
        */}
        <ul className="grid w-full grid-cols-3">
          {SCENT_NOTES.map((note) => (
            <li key={note.stage} className="flex flex-col items-center gap-1">
              <span
                aria-hidden
                className={cn(
                  'shelf-note-swatch size-8 rounded-full',
                  note.tone,
                )}
              />
              <span className="shelf-label">{note.stage}</span>
              <span className="text-caption">{note.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <MemoField item={item} onSave={onSaveMemo} />

      {/* 공용 Button 위에 바탕색·모서리·높이만 덮습니다. 높이를 직접 잡았으니 py 도 0 */}
      <div className="mt-auto flex flex-col gap-2">
        {/* 대표 향수는 보유 중 칸만. 숨기지 않고 끄는 이유는 단추 자리가 바뀌어서입니다 */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={item.category !== 'OWNED' || item.representative}
          onClick={onSetRepresentative}
          className={cn(
            'h-10 rounded-md py-0',
            'bg-[var(--chip-active)] text-[var(--paper-soft)] hover:opacity-90',
            FOCUS_RING,
          )}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path
              fill="currentColor"
              d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.7 6.1 20.8l1.2-6.6L2.5 9.5l6.6-.9L12 2.5Z"
            />
          </svg>
          {item.representative ? '대표 향수' : '대표 향수로 지정'}
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={onChangeCategory}
            className={cn('h-10 rounded-md', FOCUS_RING)}
          >
            분류 변경
          </Button>
          {/* 확인창을 화면(pages)이 띄우는 이유: 지운 뒤 무엇을 고를지는 목록을 든 쪽만 압니다 */}
          <Button
            variant="danger"
            size="sm"
            fullWidth
            onClick={onRemove}
            className={cn('h-10 rounded-md', FOCUS_RING)}
          >
            저장 해제
          </Button>
        </div>
      </div>
    </aside>
  )
}

/**
 * 개인 메모. 향수 한 개당 하나이고 향수 상세의 후기와는 별개입니다.
 *
 * 저장 단추를 따로 둔 이유: 포커스가 빠질 때 저장하면 지우다 만 글이 저장됩니다.
 * 값을 props 로 안 받는 이유: 화면이 key 로 다시 만들어 초깃값이 새로 잡힙니다.
 */
function MemoField({
  item,
  onSave,
}: {
  item: ShelfItem
  onSave: (memo: string) => void
}) {
  const initial = item.memo ?? ''
  const [draft, setDraft] = useState(initial)
  const dirty = draft.trim() !== initial.trim()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="shelf-label">Memo</span>
        {!dirty && (
          <span className="shelf-muted text-caption">
            {formatShelfDate(item.memoUpdatedAt)}
          </span>
        )}
        {dirty && (
          <button
            type="button"
            onClick={() => onSave(draft.trim())}
            className={cn(
              'text-caption underline underline-offset-2',
              'transition-opacity duration-120 ease-out hover:opacity-70',
              FOCUS_RING,
            )}
          >
            저장
          </button>
        )}
      </div>
      <Textarea
        label="개인 메모"
        hideLabel
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="이 향을 어디서 언제 맡았는지 적어두세요."
        className="shelf-field text-caption rounded-md border-0 bg-[var(--chip)]"
      />
    </div>
  )
}
