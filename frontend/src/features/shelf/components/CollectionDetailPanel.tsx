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
 * ⚠️ 이 파일만 @theme 토큰 밖의 색을 임의값으로 씁니다 — 왜인가
 *
 * 시안의 진열대 화면은 따뜻한 크림 종이(#ece5da) 위에 짙은 갈색(#4a3f33)을 얹은
 * 화면입니다. Museum Archive 의 surface(ivory #f9f6ef)와 surface-sunken(bone #e8e1d6)은
 * 둘 다 시안보다 차갑고 밝아서, 어느 쪽으로 바꿔 끼워도 시안의 종이 느낌이 나오지
 * 않습니다. 그렇다고 @theme 값을 시안에 맞추면 진열대와 상관없는 화면 색까지 전부
 * 함께 움직입니다. 그래서 **시안 확정 전 프로토타입인 이 컴포넌트에 한해** 시안에서
 * 뽑은 색을 임의값으로 적습니다. 시안이 확정되면 여기 값들을 @theme 토큰으로
 * 승격시키고 이 주석을 지웁니다.
 *
 * 반대로 본문 글자색은 토큰(text-ink #2f2f32)을 그대로 씁니다. 시안의 #2f2a24 와
 * 눈으로 구분되지 않아서, 임의값을 하나 더 늘릴 이유가 없습니다.
 * 활자 크기·간격·전환·포커스는 전부 기존 규칙 그대로입니다.
 */

/**
 * 카드 껍데기. 향수를 고르기 전과 후 두 상태가 같은 모양이어야 해서 한 곳에 둡니다.
 *
 * `rounded-[20px]` 는 시안 실측입니다. rounded-card(6px)는 "각진 아카이브" 인상을
 * 만드는 값이라 시안의 둥근 카드와 성격이 다릅니다.
 * `min-h-[580px]` 도 시안 실측(패널 높이 약 578px)이고, 선택 전후로 카드가 커졌다
 * 작아지면 병을 누를 때마다 옆 진열장까지 밀려 흔들리므로 두 상태가 함께 씁니다.
 */
const CARD = 'rounded-[20px] bg-[#ece5da] p-6 min-h-[580px]'

/**
 * 카드 위의 보조 글자색.
 *
 * text-ink-muted(#727170)를 쓰지 않은 이유: 그 색의 4.51:1 은 ivory(#f9f6ef) 위에서
 * 잰 값입니다. 이 카드 바탕(#ece5da)은 ivory 보다 어두워서 같은 색이 약 3.9:1 로
 * 떨어져 본문 대비 기준(4.5:1)에 미달합니다. 바탕에 맞춰 한 단 어둡게 잡은 따뜻한
 * 회색이고 이 카드 위에서 약 4.7:1 입니다.
 */
const MUTED_INK = 'text-[#6b6459]'

/**
 * 이 카드 위 버튼의 포커스 링.
 *
 * 굵기·색·오프셋 폭은 공용 규칙 그대로이고 오프셋 **색**만 더합니다.
 * `ring-offset-*` 의 기본색은 흰색이라, 이 크림 카드(#ece5da) 위에서는 링과 버튼
 * 사이 2px 이 흰 줄로 떠서 종이에 흰 자국이 난 것처럼 보입니다. 바탕을 토큰 밖
 * 색으로 바꾼 이 카드에서만 생기는 문제라 여기서만 오프셋 색을 맞춥니다.
 *
 * ⚠️ CARD 의 `bg-[#ece5da]` 와 같은 값입니다. 한쪽만 바꾸면 흰 줄이 다시 생깁니다.
 */
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent-deep focus-visible:ring-offset-2 focus-visible:ring-offset-[#ece5da]'

/**
 * 자간을 넓힌 소형 라벨(브랜드명 · SCENT NOTE · TOP/MIDDLE/BASE).
 *
 * `tracking-[0.18em]` 만 임의값입니다. `@theme` 에 자간 토큰이 없고, 자간은 색·크기와
 * 달리 시안이 바뀌어도 함께 갈아끼울 대상이 아니라 토큰을 새로 파지 않았습니다.
 * 대신 세 곳이 같은 값을 써야 하므로 문자열을 여기 한 번만 둡니다 —
 * 나중에 토큰이 생기면 이 상수만 고치면 됩니다.
 */
const SPACED_LABEL = `text-caption uppercase tracking-[0.18em] ${MUTED_INK}`

/**
 * 향조 3단(탑·미들·베이스).
 *
 * ⚠️ 향조는 별도 엔드포인트라 고정값입니다. 백엔드가 붙으면 이 배열 대신 props 로 받습니다.
 *
 * 시안은 원 안에 오렌지·장미·패츌리 **사진**이 들어 있는데 우리에게는 그 사진이 없습니다.
 * 빈 원으로 두면 세 개가 똑같이 보여 "세 단계가 서로 다른 향" 이라는 뜻이 사라지므로,
 * 사진이 들어올 때까지는 각 노트를 연상시키는 그러데이션으로 대신합니다.
 * (이미지가 준비되면 `swatch` 를 지우고 이 자리를 <img> 로 바꿉니다.)
 */
const SCENT_NOTES = [
  {
    stage: 'TOP',
    name: '오렌지',
    swatch: 'bg-gradient-to-br from-[#e8a35c] to-[#d4813a]',
  },
  {
    stage: 'MIDDLE',
    name: '로즈',
    swatch: 'bg-gradient-to-br from-[#e8b4ba] to-[#d68f98]',
  },
  {
    stage: 'BASE',
    name: '패츌리',
    swatch: 'bg-gradient-to-br from-[#8a8f7a] to-[#6b7060]',
  },
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
        className={cn(CARD, 'flex items-center justify-center', className)}
      >
        <p className={cn('text-caption text-center', MUTED_INK)}>
          진열대에서 향수를 선택하면 여기에 정보가 표시됩니다
        </p>
      </aside>
    )
  }

  return (
    <aside
      aria-label="선택한 향수 정보"
      className={cn(CARD, 'relative flex flex-col gap-4', className)}
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
        className={cn(
          'hover:text-ink absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full transition-colors duration-120 ease-out',
          FOCUS_RING,
          MUTED_INK,
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
        병 이미지는 배경이 투명한 PNG 로 들어옵니다(ShelfRow 와 같은 소스).
        그래서 Thumbnail 을 쓰지 않습니다 — 자리표시자 상자의 테두리·배경이
        투명 영역을 네모로 드러내 병이 상자에 든 것처럼 보입니다.
        높이 210px 은 시안 실측이고, 이미지가 없을 때도 같은 높이를 비워 둬야
        아래 글이 위아래로 튀지 않습니다.
      */}
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="h-[210px] w-full object-contain"
        />
      ) : (
        <div aria-hidden className="h-[210px]" />
      )}

      <div className="flex flex-col items-center gap-1">
        {/* 시안의 브랜드명은 자간 넓은 대문자입니다. 한글 브랜드는 uppercase 가 무시됩니다 */}
        <p className={SPACED_LABEL}>{item.brand}</p>

        {/*
          향수명만 임의 크기입니다. 시안 실측이 24px 인데 활자 스케일에는
          title(20px)과 display(28px)뿐이라 어느 쪽으로도 시안의 크기가 나오지 않습니다.
          카드 안에서 가장 큰 글자라 한 단만 어긋나도 위계가 눈에 띄게 달라져
          여기만 값을 적고, 나머지 활자는 전부 토큰을 씁니다.

          향수명을 heading 태그로 두지 않은 것은 이 패널이 놓이는 자리에 따라
          제목 단계가 달라지기 때문입니다. 대신 aside 에 aria-label 을 달아
          낭독기가 영역을 찾을 수 있게 했습니다.

          ⚠️ 시안에는 영문명 아래 국문명 줄이 한 줄 더 있지만 ShelfItem 에 국문명
          필드가 없어 생략했습니다. 백엔드가 nameKo 를 내려주면 여기에 되살립니다.
        */}
        <p className="text-ink font-serif text-[24px] leading-tight font-semibold">
          {item.name}
        </p>
      </div>

      {/*
        ⚠️ 백엔드에 향수별 한 줄 소개가 없어 고정 문구입니다.
        시안처럼 두 줄로 보이게 하되 <br /> 을 넣지 않았습니다 — 실제 문구가
        들어오면 길이가 달라져 엉뚱한 자리에서 끊깁니다. 줄바꿈은 폭에 맡기고
        text-balance 로 두 줄의 길이만 고르게 맞춥니다.

        시안대로 세리프 + 큰따옴표입니다. 앞서 이 줄을 산세리프로 뒀던 이유는
        13px 한글 세리프에서 자소가 뭉치기 때문인데, 크기를 heading(16px)으로 올려
        그 문제를 없앴습니다. styles/index.css 가 세리프를 "제목 스케일" 용으로
        정의했고 heading 이 그 스케일의 막내라 규칙 안에 있습니다.
      */}
      <p className="text-ink text-heading text-center font-serif text-balance">
        “자유롭고 당당한, 지금의 나를 닮은 향.”
      </p>

      <div className="flex flex-col items-center gap-4">
        <p className={SPACED_LABEL}>Scent Note</p>

        {/*
          원 3개(64px)와 간격 2칸(24px)이면 240px 이라, 패널이 시안 폭(300px - 여백
          48px = 252px)보다 좁아지면 자리가 모자랍니다. flex 는 이때 폭만 줄여서
          원이 타원으로 찌그러지므로, shrink-0 으로 원을 지키고 대신 줄을 바꿉니다.
          시안 폭에서는 한 줄에 다 들어가서 아무 일도 일어나지 않습니다.
        */}
        {/*
          패널 폭이 250px 이라 안쪽은 약 202px 이다. 원 48 x 3 + 간격 12 x 2 = 168px
          로 맞춰야 한 줄에 선다. 원 64 · 간격 24 였을 때는 240px 이라 두 줄로 접혔다.
        */}
        <ul className="flex justify-center gap-3">
          {SCENT_NOTES.map((note) => (
            <li key={note.stage} className="flex flex-col items-center gap-2">
              <span
                aria-hidden
                className={cn('size-12 shrink-0 rounded-full', note.swatch)}
              />
              <span className={SPACED_LABEL}>{note.stage}</span>
              <span className="text-ink text-caption">{note.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/*
        공용 Button 을 씁니다. 직접 만들면 모서리·굵기·포커스 링·전환·비활성 규칙을
        그대로 베껴 적게 되는데, 나중에 공용 쪽이 바뀔 때 이 버튼만 뒤처집니다.
        시안의 바탕색과 모서리·높이만 덮습니다 — cn(twMerge)이 variant·size 의
        bg·rounded·h 를 걷어냅니다. h-auto 로 바꾸는 이유는 size lg 의 h-12 가
        고정 높이라 py-3 이 먹지 않기 때문입니다.
        mt-auto 는 시안처럼 버튼을 카드 맨 아래에 붙입니다.

        글자색은 덮지 않습니다. 시안 실측은 #f5f1e8 인데 variant primary 가 주는
        text-surface(ivory #f9f6ef)와 이 짙은 갈색 위에서 눈으로 구분되지 않아,
        위 주석의 원칙대로 임의값을 하나 더 늘리지 않고 토큰을 그대로 둡니다.
      */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={onSave}
        className={cn(
          'mt-auto h-auto rounded-[10px] bg-[#4a3f33] py-3 hover:bg-[#38302a]',
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
