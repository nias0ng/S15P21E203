import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'

import type { ShelfItem } from '../types'

type Props = {
  item: ShelfItem | null
  onClose: () => void
  onSave: () => void
  className?: string
}

/**
 * 자간을 넓힌 소형 라벨(브랜드명 · SCENT NOTE · TOP/MIDDLE/BASE).
 *
 * `tracking-[0.18em]` 만 임의값입니다. `@theme` 에 자간 토큰이 없고, 자간은 색·크기와
 * 달리 시안이 바뀌어도 함께 갈아끼울 대상이 아니라 토큰을 새로 파지 않았습니다.
 * 대신 세 곳이 같은 값을 써야 하므로 문자열을 여기 한 번만 둡니다 —
 * 나중에 토큰이 생기면 이 상수만 고치면 됩니다.
 */
const SPACED_LABEL = 'text-caption text-ink-muted uppercase tracking-[0.18em]'

/**
 * 향조 3단(탑·미들·베이스).
 *
 * ⚠️ 향조는 별도 엔드포인트라 고정값입니다. 백엔드가 붙으면 이 배열 대신 props 로 받습니다.
 * 원형 안에 들어갈 노트 이미지도 아직 없어서 지금은 빈 원만 그립니다.
 */
const SCENT_NOTES = [
  { stage: 'TOP', name: '오렌지' },
  { stage: 'MIDDLE', name: '로즈' },
  { stage: 'BASE', name: '패츌리' },
] as const

/**
 * 컬렉션 상세 패널 (와이어프레임 A13 우측 — 진열장 목업)
 *
 * 진열대에서 병을 고르면 그 향수의 얼굴을 크게 보여주는 패널입니다.
 * `ShelfItemPanel` 이 "내가 저장한 향수를 관리"하는 쪽이라면, 이쪽은 "고른 향수를
 * 감상하고 저장"하는 쪽이라 다른 컴포넌트로 둡니다.
 */
export function CollectionDetailPanel({
  item,
  onClose,
  onSave,
  className,
}: Props) {
  if (!item) {
    return (
      <aside
        aria-label="선택한 향수 정보"
        className={cn(
          // 안내만 보일 때도 카드 껍데기와 최소 높이를 유지합니다. 선택 전후로 패널이
          // 커졌다 작아지면 병을 누를 때마다 옆 진열대까지 밀려 흔들립니다.
          'bg-surface-sunken rounded-card flex min-h-72 items-center justify-center p-6',
          className,
        )}
      >
        <p className="text-caption text-ink-muted text-center">
          진열대에서 향수를 선택하면 여기에 정보가 표시됩니다
        </p>
      </aside>
    )
  }

  return (
    <aside
      aria-label="선택한 향수 정보"
      className={cn('bg-surface-sunken rounded-card relative p-6', className)}
    >
      {/*
        여기만 공용 Button 을 쓰지 않는 이유는 CollectionFooterStrip 의 넘김 버튼과
        같습니다 — 공용 버튼은 어떤 variant 든 호버 배경이 생기는데, 이 × 는 종이 위에
        인쇄된 기호처럼 배경 없이 글자색만 바뀌어야 합니다. 대신 공통 규칙 중
        포커스 링과 색 전환(duration-120)은 그대로 가져옵니다.
      */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="text-ink-muted hover:text-ink focus-visible:ring-accent-deep rounded-card absolute top-4 right-4 inline-flex size-8 items-center justify-center transition-colors duration-120 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <span aria-hidden className="text-title leading-none">
          ×
        </span>
      </button>

      <div className="flex flex-col gap-6">
        {/*
          병 이미지는 배경이 투명한 PNG 로 들어옵니다(ShelfRow 와 같은 소스).
          그래서 Thumbnail 을 쓰지 않습니다 — 자리표시자 상자의 테두리·배경이
          투명 영역을 네모로 드러내 병이 상자에 든 것처럼 보입니다.
          이미지가 없을 때도 h-52 를 유지해 아래 글이 위아래로 튀지 않게 합니다.
        */}
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-52 w-full object-contain"
          />
        ) : (
          <div aria-hidden className="h-52" />
        )}

        <div className="flex flex-col items-center gap-1">
          {/* 목업의 브랜드명은 자간 넓은 대문자입니다. 한글 브랜드는 uppercase 가 무시됩니다 */}
          <p className={SPACED_LABEL}>{item.brand}</p>

          <p className="text-title text-ink font-serif font-semibold">
            {item.name}
          </p>

          {/*
            목업에는 영문명 아래 국문명 줄이 있지만 ShelfItem 에 국문명 필드가 없어
            생략했습니다. 백엔드가 nameKo 를 내려주면 여기에 한 줄을 되살립니다.

            향수명을 heading 태그로 두지 않은 것은 이 패널이 놓이는 자리에 따라
            제목 단계가 달라지기 때문입니다. 대신 aside 에 aria-label 을 달아
            낭독기가 영역을 찾을 수 있게 했습니다.
          */}
        </div>

        {/*
          ⚠️ 백엔드에 향수별 한 줄 소개가 없어 고정 문구입니다.
          목업처럼 두 줄로 보이게 하되 <br /> 을 넣지 않았습니다 — 실제 문구가
          들어오면 길이가 달라져 엉뚱한 자리에서 끊깁니다. 줄바꿈은 폭에 맡기고
          text-balance 로 두 줄의 길이만 고르게 맞춥니다.

          세리프를 걷어냈습니다. 세리프는 제목 스케일에만 씁니다(styles/index.css 주석 —
          "본문까지 세리프면 한글 가독성이 떨어져서 제목에만 씁니다"). 13px 한글은
          세리프에서 자소가 뭉칩니다. 같은 화면의 CollectionFooterStrip 도 장식 문구를
          산세리프로 씁니다.
        */}
        <p className="text-body text-ink text-center text-balance">
          “자유롭고 당당한, 지금의 나를 닮은 향.”
        </p>

        <div className="flex flex-col items-center gap-4">
          <p className={SPACED_LABEL}>Scent Note</p>

          <ul className="flex justify-center gap-6">
            {SCENT_NOTES.map((note) => (
              <li key={note.stage} className="flex flex-col items-center gap-2">
                {/* 노트 이미지가 들어올 자리. 지금은 빈 원입니다 */}
                <span
                  aria-hidden
                  className="bg-surface-card border-line size-14 rounded-full border"
                />
                <span className={SPACED_LABEL}>{note.stage}</span>
                <span className="text-caption text-ink">{note.name}</span>
              </li>
            ))}
          </ul>
        </div>

        {/*
          공용 Button 을 씁니다. 직접 만들면 모서리·굵기·포커스 링·전환·비활성 규칙을
          그대로 베껴 적게 되는데, 나중에 공용 쪽이 바뀔 때 이 버튼만 뒤처집니다.
          바탕만 목업의 브론즈로 덮습니다 — cn(twMerge)이 variant 의 bg 를 걷어냅니다.
          같은 화면 CollectionFilters 의 선택된 칩과 같은 색이라, 이 화면에서
          "지금 누를 것" 은 전부 accent-deep 으로 읽힙니다.
        */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onSave}
          className="bg-accent-deep hover:bg-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path
              fill="currentColor"
              d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.7 6.1 20.8l1.2-6.6L2.5 9.5l6.6-.9L12 2.5Z"
            />
          </svg>
          나의 향수로 저장
        </Button>
      </div>
    </aside>
  )
}
