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
 * 카드 껍데기. 고르기 전과 후가 같은 모양이어야 해서 한 곳에 둡니다.
 *
 * ⚠️ **이 카드의 높이가 화면 구성을 좌우합니다.** 진열장(415px)보다 키가 커서
 * 가운데 줄의 높이를 이 카드가 정합니다. 안쪽 무엇이든 키우면 하단 띠가 1440x900
 * 밖으로 밀립니다 — 사진 높이 · 간격 · 향조 원 지름 · 메모 줄 수가 전부 그래서
 * 시안보다 한 단씩 작습니다. 바꿀 때는 `main section` 높이를 재세요. 상한 830px.
 *
 * 치수는 시안 실측입니다. 최소 높이를 두 상태가 함께 쓰는 이유: 선택 전후로
 * 카드가 커졌다 작아지면 병을 누를 때마다 옆 진열장까지 밀려 흔들립니다.
 */
const CARD = 'shelf-panel rounded-[14px] px-6 pt-5 pb-3 min-h-[501px]'

/**
 * 이 카드 위 버튼의 포커스 링.
 *
 * `ring-offset-*` 의 기본색이 흰색이라, 크림 카드 위에서는 링과 버튼 사이 2px 이
 * 흰 줄로 떠 보입니다. 그래서 오프셋 **색**만 이 화면 팔레트로 덮습니다.
 */
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper-soft)]'

/**
 * 향조 3단(탑·미들·베이스).
 *
 * ⚠️ 향조는 별도 엔드포인트라 고정값입니다. 백엔드가 붙으면 이 배열 대신 props 로 받습니다.
 *
 * 시안은 원 안에 향 재료 사진이 들어 있는데 우리에겐 그 사진이 없습니다. 빈 원으로
 * 두면 셋이 똑같아 보여 "단계마다 다른 향" 이라는 뜻이 사라지므로 색으로 대신합니다.
 * 사진이 준비되면 `tone` 을 지우고 이 자리를 <img> 로 바꿉니다.
 */
const SCENT_NOTES = [
  { stage: 'TOP', name: '오렌지', tone: 'shelf-note-citrus' },
  { stage: 'MIDDLE', name: '로즈', tone: 'shelf-note-floral' },
  { stage: 'BASE', name: '패츌리', tone: 'shelf-note-wood' },
] as const

/**
 * 컬렉션 상세 패널 (와이어프레임 A13 우측 — 진열장 시안)
 *
 * 진열대에서 병을 고르면 그 향수의 얼굴을 크게 보여주는 패널입니다.
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
          heading 태그가 아닌 이유: 이 패널이 놓이는 자리에 따라 제목 단계가
          달라집니다. 대신 aside 의 aria-label 로 낭독기가 영역을 찾습니다.

          ⚠️ 시안에는 영문명 아래 국문명 줄이 하나 더 있지만 ShelfItem 에 국문명
          필드가 없어 생략했습니다. 백엔드가 nameKo 를 내려주면 되살립니다.
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

      {/*
        조작 세 가지. 공용 Button 위에 시안의 바탕색·모서리·높이만 덮습니다
        (cn(twMerge)이 variant·size 의 bg·rounded·h 를 걷어냅니다). 높이를 직접
        잡았으므로 py 도 0 으로 둬야 글자가 아래로 눌리지 않습니다.
      */}
      <div className="mt-auto flex flex-col gap-2">
        {/*
          대표 향수는 보유 중 칸에만 뜻이 있습니다 — 시향만 해 봤거나 아직 안 산
          향수를 "나를 대표하는 향" 으로 두는 건 맞지 않습니다. 숨기지 않고 끄는
          이유: 사라지면 아래 두 단추가 위로 밀려 올라와 병을 옮길 때마다 자리가 바뀝니다.
        */}
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
 * 저장 단추를 따로 둔 이유: 포커스가 빠질 때 조용히 저장하면 지우다 만 글이
 * 저장됩니다. 안 고쳤을 때 꺼 두는 것이 "아직 안 바뀌었다" 표시도 됩니다.
 *
 * 값을 props 로 받지 않는 이유: 화면이 key 로 이 컴포넌트를 다시 만들어 초깃값이
 * 새로 잡힙니다. useEffect 로 맞추면 저장 실패로 되돌아온 값과 지금 치는 글이 싸웁니다.
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
