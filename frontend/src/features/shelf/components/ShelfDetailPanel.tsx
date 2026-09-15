import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Textarea'

import { formatShelfDate } from '../lib'
import type { ShelfItem } from '../types'

type Props = {
  item: ShelfItem | null
  /** 대표 향수로 지정 (보유 중 칸에서만 뜻이 있습니다 — 아래 주석) */
  onSetRepresentative: () => void
  /** 분류 변경 모달 열기 */
  onChangeCategory: () => void
  /** 진열대에서 빼기. 되돌릴 수 없어서 화면이 확인창을 띄웁니다 */
  onRemove: () => void
  onSaveMemo: (memo: string) => void
  className?: string
}

/*
 * ⚠️ 이 파일은 @theme 토큰 대신 `../shelf-display.css` 의 진열대 전용 색을 씁니다.
 * 이유는 그 파일 머리말에 한 번만 적어 두었습니다 — 요약하면, Museum Archive 의
 * ivory 는 시안의 따뜻한 크림보다 밝고 차가워서 그대로 얹으면 패널이 종이에
 * 묻힙니다. 시안이 확정되면 그 색들을 @theme 으로 올리고 여기 var() 를 토큰으로
 * 바꿉니다. 활자 크기·간격·전환·포커스는 전부 기존 규칙 그대로입니다.
 */

/*
 * ⚠️ 이 카드는 1920 규격 크기로 짜고, 작은 화면에서는 통째로 줄입니다.
 *
 * 진열대 화면은 스크롤하지 않는 한 장이고, 이 카드는 벽감과 윗선 · 높이를 맞춥니다.
 * 안쪽 치수(여백 · 사진 · 글자 · 단추)는 전부 1920 x 1080 기준(폭 340 · 벽감 605)으로 적고,
 * 화면이 작아져 벽감이 낮아지면 카드가 `zoom: var(--panel-scale)` 로 같은 비율만큼
 * 줄어듭니다(배율은 lib.ts 의 shelfLayout 이 정하고 ShelfWall 이 넣습니다).
 * 그래서 **1920 에서 내용이 벽감(605) 안에 들면 작은 화면에서도 벽감을 넘지 않습니다.**
 * 안쪽 무엇이든 키울 때는 1920 에서 이 조건을 확인하세요. 사진 높이 · 사이 간격 ·
 * 향조 원 지름 · 메모 줄 수가 시안보다 한 단씩 작은 것도 이 높이 안에 조작을 다 담기 위해서입니다.
 *
 * transform: scale 이 아니라 zoom 인 이유: transform 은 그림만 줄이고 자리는 원래 크기대로
 * 차지합니다. zoom 은 줄어든 크기로 자리를 잡고, 글자도 그 크기로 다시 그려 흐려지지 않습니다.
 */

/**
 * 카드 껍데기. 향수를 고르기 전과 후 두 상태가 같은 모양이어야 해서 한 곳에 둡니다.
 *
 * `rounded-[14px]` 과 여백은 시안 실측을 치수 끝자리 0/5 로 맞춘 값입니다
 * (위 20 · 좌우 25 · 아래 10). rounded-card(6px)는 "각진 아카이브"
 * 인상을 만드는 값이라 시안의 둥근 카드와 성격이 다릅니다.
 *
 * 높이는 ShelfWall 이 자리를 벽감 + 이름표 자리 높이로 잡고 이 카드를 flex-1 로 채워 정합니다. 선택 전후
 * 두 상태가 같은 높이라, 병을 누를 때마다 카드가 커졌다 작아지지 않습니다.
 * 조작 단추는 mt-auto 로 늘 맨 아래입니다.
 *
 * `[zoom:var(--panel-scale,1)]` 이 작은 화면에서 카드를 통째로 줄입니다(위 설명). 값이 없으면
 * 1 이라 진열대 밖에 두어도 원래 크기입니다.
 *
 * `.shelf-panel` 이 반투명 바탕 · 그림자 · backdrop-blur 를 냅니다. 뒤의 종이가
 * 살짝 비쳐서 "종이 위에 얹힌 카드" 로 읽힙니다.
 */
const CARD =
  'shelf-panel rounded-[14px] px-6.25 pt-5 pb-2.5 [zoom:var(--panel-scale,1)]'

/**
 * 이 카드 위 버튼의 포커스 링.
 *
 * 굵기·오프셋 폭은 공용 규칙 그대로이고 색과 오프셋 **색**만 이 화면 팔레트로
 * 맞춥니다. `ring-offset-*` 의 기본색은 흰색이라, 크림 카드 위에서는 링과 버튼
 * 사이 2px 이 흰 줄로 떠서 종이에 흰 자국이 난 것처럼 보입니다.
 */
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper-soft)]'

/**
 * 향조 3단(탑·미들·베이스).
 *
 * ⚠️ 향조는 별도 엔드포인트라 고정값입니다. 백엔드가 붙으면 이 배열 대신 props 로 받습니다.
 *
 * 시안은 원 안에 오렌지·장미·패츌리 **사진**이 들어 있는데 우리에게는 그 사진이 없습니다.
 * 빈 원으로 두면 세 개가 똑같이 보여 "세 단계가 서로 다른 향" 이라는 뜻이 사라지므로,
 * 사진이 들어올 때까지는 시안 팔레트의 향조 색으로 대신합니다.
 * (이미지가 준비되면 `tone` 을 지우고 이 자리를 <img> 로 바꿉니다.)
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
      className={cn(CARD, '@container flex flex-col', className)}
    >
      {/*
        두 묶음 — 얼굴(사진 · 이름 · 소개)과 기록(향조 · 메모 · 조작).
        카드가 좁으면(벽 위에 얹힐 때 · 휴대폰) 위아래로, 넓으면(쌓는 배치의 태블릿 폭)
        좌우 두 단으로 섭니다. 화면 폭이 아니라 **카드 폭(@container)** 으로 가릅니다 —
        같은 화면 폭이라도 카드가 놓이는 자리에 따라 폭이 다릅니다.
      */}
      <div className="flex flex-1 flex-col gap-2.5 @xl:flex-row @xl:gap-7.5">
        <div className="flex flex-col gap-2.5 @xl:flex-1 @xl:justify-center">
          {/*
        병 이미지는 배경이 투명한 PNG 로 들어옵니다(DisplayCase 와 같은 소스).
        그래서 Thumbnail 을 쓰지 않습니다 — 자리표시자 상자의 테두리·배경이
        투명 영역을 네모로 드러내 병이 상자에 든 것처럼 보입니다.
        높이는 시안이 180px 인데 100px 로 줄였습니다. 시안에 없던 조작(대표 지정 ·
        분류 변경 · 저장 해제 · 메모)이 아래에 들어오면서, 벽감 높이 안에 다 담으려면
        어딘가를 줄여야 했습니다. 사진은 줄여도 무엇인지 알아볼 수 있지만 조작은 줄이면
        못 누릅니다.
        두 단으로 넓게 설 때(쌓는 배치)는 세로 자리가 넉넉해 시안의 180px 로 둡니다.
        이미지가 없을 때도 같은 높이를 비워 둬야 아래 글이 위아래로 튀지 않습니다.

        고른 병의 사진이라 먼저 받고(fetchPriority high) 그 자리에서 풀어 그립니다(decoding sync).
        벽의 그 병과 같은 주소라 이미 받아 둔 사진을 씁니다. 병을 바꿀 때마다 key 로 새로 그려서,
        비동기로 풀면 사진 자리가 한 프레임 비었다 채워집니다.
      */}
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              fetchPriority="high"
              decoding="sync"
              className="shelf-bottle-img h-[100px] w-full object-contain @xl:h-[180px]"
            />
          ) : (
            <div aria-hidden className="h-[100px] @xl:h-[180px]" />
          )}

          <div className="flex flex-col items-center gap-1.25">
            {/* 시안의 브랜드명은 자간 넓은 대문자입니다. 한글 브랜드는 uppercase 가 무시됩니다 */}
            <p className="shelf-label">{item.brand}</p>

            {/*
          시안의 향수명이 20px 이라 활자 스케일의 title 이 그대로 맞습니다.
          앞서 24px 임의값을 쓰던 자리인데, 실측을 다시 재 보니 스케일 안에 있어
          토큰으로 되돌렸습니다.

          향수명을 heading 태그로 두지 않은 것은 이 패널이 놓이는 자리에 따라
          제목 단계가 달라지기 때문입니다. 대신 aside 에 aria-label 을 달아
          낭독기가 영역을 찾을 수 있게 했습니다.

          ⚠️ 시안에는 영문명 아래 국문명 줄이 한 줄 더 있지만 ShelfItem 에 국문명
          필드가 없어 생략했습니다. 백엔드가 nameKo 를 내려주면 여기에 되살립니다.
        */}
            <p className="text-title text-center font-serif leading-tight font-semibold">
              {item.name}
            </p>
          </div>

          {/*
        ⚠️ 백엔드에 향수별 한 줄 소개가 없어 고정 문구입니다.
        시안처럼 두 줄로 보이게 하되 <br /> 을 넣지 않았습니다 — 실제 문구가
        들어오면 길이가 달라져 엉뚱한 자리에서 끊깁니다. 줄바꿈은 폭에 맡기고
        text-balance 로 두 줄의 길이만 고르게 맞춥니다.

        크기는 시안이 12px 인데 우리 활자 스케일의 최소 본문이 body(13px)라
        한 단 위를 씁니다. 12px 를 임의값으로 적으면 이 화면만 스케일 밖으로
        나가는데, 1px 때문에 그럴 이유가 없습니다.
      */}
          <p className="text-body text-center font-serif text-balance">
            “자유롭고 당당한, 지금의 나를 닮은 향.”
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-2.5">
          <div className="flex flex-col items-center gap-2.5">
            <p className="shelf-label">Scent Note</p>

            {/*
          flex 가 아니라 3열 그리드입니다. flex 로 두면 이름 길이("패츌리" 3자 vs
          "베르가못" 4자)에 따라 칸이 서로 달라져 원 세 개가 가운데 정렬에서
          어긋납니다. 그리드면 이름이 무엇이든 원의 간격이 같습니다.

          원 지름 30px 은 시안 실측(36px)을 이 카드 높이에 맞춰 한 단 줄인 값입니다.
          패널 안쪽 폭 290px(1920 기준 — 작은 화면에서는 카드째 줄어 비율이 같습니다)을
          셋으로 나눈 95px 남짓 안에 원과 라벨이 함께 들어갑니다.
        */}
            <ul className="grid w-full grid-cols-3">
              {SCENT_NOTES.map((note) => (
                <li
                  key={note.stage}
                  className="flex flex-col items-center gap-1.25"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'shelf-note-swatch size-7.5 rounded-full',
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
        조작 세 가지. mt-auto 로 카드 맨 아래에 붙입니다.

        공용 Button 을 씁니다. 직접 만들면 모서리·굵기·포커스 링·전환·비활성 규칙을
        그대로 베껴 적게 되는데, 나중에 공용 쪽이 바뀔 때 이 버튼만 뒤처집니다.
        시안의 바탕색과 모서리(6px)·높이만 덮습니다 — cn(twMerge)이 variant·size 의
        bg·rounded·h 를 걷어냅니다. size lg 의 세로 여백(py)도 0 으로 두는 이유는,
        높이를 직접 잡은 뒤에도 py 가 남아 있으면 글자가 아래로 눌리기 때문입니다.
      */}
          <div className="mt-auto flex flex-col gap-2.5">
            {/*
          ⚠️ 대표 향수는 **보유 중 칸에만** 표시됩니다(와이어프레임 A13 주석 ·
          `ShelfItem.representative`). 시향만 해 본 향수나 아직 안 산 향수를 "나를
          대표하는 향" 으로 두는 건 뜻이 맞지 않아서, 다른 칸에서는 끕니다.
          숨기지 않고 끄는 이유: 사라지면 아래 두 단추의 자리가 위로 밀려 올라와,
          병을 옮겨 다닐 때마다 단추 위치가 바뀝니다.
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
              <svg viewBox="0 0 24 24" aria-hidden className="size-3.75">
                <path
                  fill="currentColor"
                  d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.7 6.1 20.8l1.2-6.6L2.5 9.5l6.6-.9L12 2.5Z"
                />
              </svg>
              {item.representative ? '대표 향수' : '대표 향수로 지정'}
            </Button>

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={onChangeCategory}
                className={cn('h-10 rounded-md', FOCUS_RING)}
              >
                분류 변경
              </Button>
              {/*
            되돌릴 수 없는 조작이라 danger 입니다. 확인창은 화면(pages)이 띄웁니다 —
            지운 뒤 무엇을 고를지는 목록을 들고 있는 쪽만 알 수 있습니다.
          */}
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
        </div>
      </div>
    </aside>
  )
}

/**
 * 개인 메모.
 *
 * ⚠️ 메모는 향수 한 개당 하나입니다(와이어프레임 A15 주석). 향수 상세의 후기와는
 * 별개고, 남에게 보이지 않습니다.
 *
 * 저장 단추를 따로 둔 이유: 포커스가 빠질 때 조용히 저장하면, 지우다 만 글이
 * 그대로 저장되는 일이 생깁니다. 고치지 않았을 때는 꺼 두어서 "아직 안 바뀌었다" 를
 * 단추 상태로 알려줍니다.
 *
 * 값을 props 로 받지 않고 여기서 들고 있는 이유: 향수를 바꾸면 화면이 key 로 이
 * 컴포넌트를 다시 만들어서 초깃값이 새로 잡힙니다. useEffect 로 맞추면 저장 실패로
 * 되돌아오는 값과 사용자가 지금 치고 있는 글이 싸웁니다.
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
    <div className="flex flex-col gap-1.25">
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
