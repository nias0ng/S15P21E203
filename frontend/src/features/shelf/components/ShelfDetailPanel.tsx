import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'

import type { ShelfItem } from '../types'

type Props = {
  item: ShelfItem | null
  onClose: () => void
  onSave: () => void
  className?: string
}

/*
 * ⚠️ 이 파일은 @theme 토큰 대신 `../shelf-display.css` 의 진열대 전용 색을 씁니다.
 * 이유는 그 파일 머리말에 한 번만 적어 두었습니다 — 요약하면, Museum Archive 의
 * ivory 는 시안의 따뜻한 크림보다 밝고 차가워서 그대로 얹으면 패널이 종이에
 * 묻힙니다. 시안이 확정되면 그 색들을 @theme 으로 올리고 여기 var() 를 토큰으로
 * 바꿉니다. 활자 크기·간격·전환·포커스는 전부 기존 규칙 그대로입니다.
 */

/**
 * 카드 껍데기. 향수를 고르기 전과 후 두 상태가 같은 모양이어야 해서 한 곳에 둡니다.
 *
 * `rounded-[14px]` · `min-h-[501px]` 과 여백(위 24 · 좌우 24 · 아래 16)은 시안
 * 실측입니다. rounded-card(6px)는 "각진 아카이브" 인상을 만드는 값이라 시안의
 * 둥근 카드와 성격이 다릅니다.
 * 최소 높이를 두 상태가 함께 쓰는 이유: 선택 전후로 카드가 커졌다 작아지면
 * 병을 누를 때마다 옆 진열장까지 밀려 흔들립니다.
 *
 * ⚠️ 카드 높이가 이 화면의 한 장(머리말~하단 띠가 한 화면)을 좌우합니다. 안쪽
 * 무엇이든 키우면 진열장 줄이 함께 길어져 하단 띠가 화면 밖으로 밀립니다.
 *
 * `.shelf-panel` 이 반투명 바탕 · 그림자 · backdrop-blur 를 냅니다. 뒤의 종이가
 * 살짝 비쳐서 "종이 위에 얹힌 카드" 로 읽힙니다.
 */
const CARD = 'shelf-panel rounded-[14px] px-6 pt-6 pb-4 min-h-[501px]'

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
 * 자간을 넓힌 소형 라벨(브랜드명 · SCENT NOTE · TOP/MIDDLE/BASE).
 *
 * `tracking-[0.18em]` 만 임의값입니다. `@theme` 에 자간 토큰이 없고, 자간은 색·크기와
 * 달리 시안이 바뀌어도 함께 갈아끼울 대상이 아니라 토큰을 새로 파지 않았습니다.
 * 대신 세 곳이 같은 값을 써야 하므로 문자열을 여기 한 번만 둡니다 —
 * 나중에 토큰이 생기면 이 상수만 고치면 됩니다.
 */
const SPACED_LABEL = 'shelf-muted text-caption uppercase tracking-[0.18em]'

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
 * `ShelfItemPanel` 이 "내가 저장한 향수를 관리"하는 쪽이라면, 이쪽은 "고른 향수를
 * 감상하고 저장"하는 쪽이라 다른 컴포넌트로 둡니다.
 *
 * 카드 폭은 정하지 않습니다 — 진열장과 나란히 놓이는 자리라 화면(pages)이 정합니다.
 */
export function ShelfDetailPanel({ item, onClose, onSave, className }: Props) {
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
      className={cn(CARD, 'relative flex flex-col gap-3', className)}
    >
      {/*
        여기만 공용 Button 을 쓰지 않는 이유는 ShelfFooterStrip 의 넘김 버튼과
        같습니다 — 공용 버튼은 어떤 variant 든 호버 배경이 생기는데, 이 × 는 종이 위에
        인쇄된 기호처럼 배경 없이 글자색만 바뀌어야 합니다. 대신 공통 규칙 중
        포커스 링과 색 전환(duration-120)은 그대로 가져옵니다.
      */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className={cn(
          'shelf-muted absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full',
          'transition-colors duration-120 ease-out hover:text-[var(--shelf-ink)]',
          FOCUS_RING,
        )}
      >
        {/*
          × 글리프 대신 선을 직접 긋습니다. 글리프는 폰트마다 굵기와 크기가 달라
          시안의 "가는 선 두 개" 가 재현되지 않습니다(Noto Sans KR 에서는 굵게 나옵니다).
        */}
        <svg viewBox="0 0 16 16" aria-hidden className="size-4">
          <path
            d="M3.5 3.5l9 9M12.5 3.5l-9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/*
        병 이미지는 배경이 투명한 PNG 로 들어옵니다(DisplayCase 와 같은 소스).
        그래서 Thumbnail 을 쓰지 않습니다 — 자리표시자 상자의 테두리·배경이
        투명 영역을 네모로 드러내 병이 상자에 든 것처럼 보입니다.
        높이 180px 은 시안 실측이고, 이미지가 없을 때도 같은 높이를 비워 둬야
        아래 글이 위아래로 튀지 않습니다.
      */}
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="shelf-bottle-img h-[180px] w-full object-contain"
        />
      ) : (
        <div aria-hidden className="h-[180px]" />
      )}

      <div className="flex flex-col items-center gap-1">
        {/* 시안의 브랜드명은 자간 넓은 대문자입니다. 한글 브랜드는 uppercase 가 무시됩니다 */}
        <p className={SPACED_LABEL}>{item.brand}</p>

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

      <div className="flex flex-col items-center gap-2.5">
        <p className={SPACED_LABEL}>Scent Note</p>

        {/*
          flex 가 아니라 3열 그리드입니다. flex 로 두면 이름 길이("패츌리" 3자 vs
          "베르가못" 4자)에 따라 칸이 서로 달라져 원 세 개가 가운데 정렬에서
          어긋납니다. 그리드면 이름이 무엇이든 원의 간격이 같습니다.

          원 지름 36px 도 시안 실측입니다. 패널 안쪽 폭 246px 을 셋으로 나눈 82px
          안에 원과 라벨이 함께 들어갑니다.
        */}
        <ul className="grid w-full grid-cols-3">
          {SCENT_NOTES.map((note) => (
            <li key={note.stage} className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'shelf-note-swatch size-9 rounded-full',
                  note.tone,
                )}
              />
              <span className={SPACED_LABEL}>{note.stage}</span>
              <span className="text-caption">{note.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/*
        공용 Button 을 씁니다. 직접 만들면 모서리·굵기·포커스 링·전환·비활성 규칙을
        그대로 베껴 적게 되는데, 나중에 공용 쪽이 바뀔 때 이 버튼만 뒤처집니다.
        시안의 바탕색과 모서리(6px)·높이(46px)만 덮습니다 — cn(twMerge)이 variant·size 의
        bg·rounded·h 를 걷어냅니다. size lg 의 세로 여백(py)도 함께 0 으로 두는 이유는,
        높이를 직접 잡은 뒤에도 py 가 남아 있으면 아이콘과 글자가 아래로 눌리기 때문입니다.
        mt-auto 는 시안처럼 버튼을 카드 맨 아래에 붙입니다.
      */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={onSave}
        className={cn(
          'mt-auto h-[46px] rounded-md py-0',
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
        나의 향수로 저장
      </Button>
    </aside>
  )
}
