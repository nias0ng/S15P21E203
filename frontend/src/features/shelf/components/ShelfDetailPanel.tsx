import { Fragment } from 'react'
import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { StarRating } from '@/shared/ui/StarRating'

import { formatShelfDate, NOTE_STAGES, noteRows } from '../lib'
import {
  SHELF_CATEGORIES,
  SHELF_CATEGORY_CAPTION,
  type ShelfItemDetail,
} from '../types'

type Props = {
  /**
   * 고른 한 병. 적합도 · 메모 · 향조가 상세 응답에만 있어 목록 타입이 아니라 상세를 받습니다.
   *
   * 화면은 목록이 아는 값(이름 · 브랜드 · 사진)으로 먼저 채운 것을 넘기고, 상세가
   * 도착하면 그걸로 바꿔 넘깁니다 — 카드를 넘길 때마다 패널이 비지 않습니다.
   */
  item: ShelfItemDetail | null
  /**
   * 상세가 아직 오지 않았다 — 화면이 목록이 아는 값으로 먼저 채워 넘긴 동안입니다. 향조 · 메모 자리를
   * "없어요" 대신 빈 줄로 비워 둡니다. 곧 찰 자리에 없다고 적으면 병을 고를 때마다 틀린 말이 번쩍입니다.
   */
  pending?: boolean
  /**
   * 취향 적합도 매기기. 1.0~5.0 을 0.5 단위로 넘깁니다.
   *
   * 지우는 길은 여기 없습니다 — 해제는 [변경하기] 모달에서 합니다. 메모와 같은
   * 이유로, 같은 값을 고치는 입구가 둘이면 한쪽만 쓰이고 다른 쪽은 잊힙니다.
   */
  onChangeRating: (rating: number) => void
  /** 변경 모달 열기 — 분류 · 적합도 · 메모를 한 자리에서 고칩니다 */
  onEdit: () => void
  /** 진열대에서 빼기. 되돌릴 수 없어서 화면이 확인창을 띄웁니다 */
  onRemove: () => void
  /**
   * 고른 병이 없을 때 카드에 적는 말. 주지 않으면 "진열대에서 향수를 선택하면 …" 입니다 — 빈 분류가
   * 벽에 섰을 때처럼 고를 병 자체가 없는 자리에서는 화면이 다른 말을 넘깁니다.
   */
  placeholder?: string
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
 * 안쪽 치수(여백 · 사진 · 글자 · 단추)는 전부 1920 x 1080 기준(폭 365 · 높이 710)으로 적고,
 * 화면이 작아져 벽감이 낮아지면 카드가 `zoom: var(--panel-scale)` 로 같은 비율만큼
 * 줄어듭니다(배율은 lib.ts 의 shelfLayout 이 정하고 ShelfWall 이 넣습니다).
 *
 * transform: scale 이 아니라 zoom 인 이유: transform 은 그림만 줄이고 자리는 원래 크기대로
 * 차지합니다. zoom 은 줄어든 크기로 자리를 잡고, 글자도 그 크기로 다시 그려 흐려지지 않습니다.
 */

/**
 * 카드 껍데기. 향수를 고르기 전과 후 두 상태가 같은 모양이어야 해서 한 곳에 둡니다.
 *
 * 종이 · 그림자는 `.shelf-panel` 이 냅니다 — 개인화 추천 편지와 **같은 종이**입니다(shelf-display.css
 * 의 "상세 카드 — 결과지"). 편지가 이 카드 자리에 꼭 맞게 펼쳐져서, 둘이 다른 종이면 편지를 접을
 * 때마다 종이가 바뀌어 보입니다.
 *
 * 높이는 ShelfWall 이 자리를 벽감 + 이름표 자리 높이로 잡고 이 카드를 flex-1 로 채워 정합니다. 선택 전후
 * 두 상태가 같은 높이라, 병을 누를 때마다 카드가 커졌다 작아지지 않습니다.
 *
 * `[zoom:var(--panel-scale,1)]` 이 작은 화면에서 카드를 통째로 줄입니다(위 설명). 값이 없으면
 * 1 이라 진열대 밖에 두어도 원래 크기입니다.
 */
const CARD =
  'shelf-panel relative rounded-[14px] px-5 pt-5 pb-5 [zoom:var(--panel-scale,1)]'

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
 * 향조 한 줄에 적는 노트 수. 넘치면 "외 N" 으로 줄입니다 — 카드 안쪽 폭(1920 에서 325)에서 단계 이름을
 * 뺀 자리에 한 줄로 드는 만큼입니다. 전부는 줄에 마우스를 올리면(title) 보입니다.
 */
const NOTES_PER_ROW = 3

/**
 * 컬렉션 상세 패널 (와이어프레임 A13 우측 — 진열장 시안) · 결과지 짜임 (S15P21E203-431)
 *
 * 진열대에서 병을 고르면 그 향수의 얼굴을 크게 보여주는 패널입니다. 개인화 추천 편지와 같은 종이 ·
 * 같은 활자로 **결과지처럼** 씁니다 — 위에서 아래로 분류(작은 이탤릭) · 병 · 브랜드 · 이름 · 적합도를
 * 가운데로 모으고, 그 아래 향조 표 · 조작(저장 해제 · 변경하기) · 메모가 카드 아래에 모입니다.
 *
 * 예전에는 글이 전부 왼쪽 끝에 붙고 향조가 색 구슬 셋(모든 향수에 오렌지 · 로즈 · 패츌리 고정값)이라,
 * 편지가 펼쳐졌다 접힐 때 같은 자리의 두 카드가 다른 물건처럼 보였습니다. 향조는 이제 상세 응답의
 * 실제 노트입니다(lib.ts 의 noteRows).
 *
 * 카드 폭은 정하지 않습니다 — 진열장과 나란히 놓이는 자리라 화면(pages)이 정합니다.
 */
export function ShelfDetailPanel({
  item,
  pending = false,
  onChangeRating,
  onEdit,
  onRemove,
  placeholder = '진열대에서 향수를 선택하면 여기에 정보가 표시됩니다',
  className,
}: Props) {
  if (!item) {
    return (
      <aside
        aria-label="선택한 향수 정보"
        className={cn(CARD, 'flex items-center justify-center', className)}
      >
        <p className="shelf-muted text-body px-5 text-center break-keep">
          {placeholder}
        </p>
      </aside>
    )
  }

  const category = SHELF_CATEGORIES.find(
    (entry) => entry.value === item.category,
  )

  return (
    <aside
      aria-label="선택한 향수 정보"
      className={cn(CARD, '@container flex flex-col', className)}
    >
      {/*
        머리 — 이 병이 선 분류. 편지의 "FOR YOU" 자리입니다. 영문은 한글 분류를 되풀이하는
        장식이라 낭독기에는 한글 분류만 읽힙니다.
      */}
      <p className="shelf-sheet-kicker">
        <span aria-hidden lang="en">
          {SHELF_CATEGORY_CAPTION[item.category]}
        </span>
        <span className="sr-only">{category?.label}</span>
      </p>

      {/*
        두 묶음 — 얼굴(사진 · 이름 · 적합도)과 기록(향조 · 조작 · 메모).
        카드가 좁으면(벽 위에 얹힐 때 · 휴대폰) 위아래로, 넓으면(쌓는 배치의 태블릿 폭)
        좌우 두 단으로 섭니다. 화면 폭이 아니라 **카드 폭(@container)** 으로 가릅니다 —
        같은 화면 폭이라도 카드가 놓이는 자리에 따라 폭이 다릅니다.

        위아래로 설 때 남는 세로 자리는 병이 먹고(아래 .shelf-sheet-bottle — 255 까지), 그래도 남으면
        얼굴과 기록 사이가 벌어집니다. 기록은 늘 카드 아래에 붙어서, 향조 줄 수가 바뀌어도 병이 튀지
        않습니다.
      */}
      <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-3.75 @xl:flex-row @xl:gap-7.5">
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3.75 text-center @xl:justify-center">
          {/*
            병 자리 — 카드에서 **남는 높이만** 씁니다(150 ~ 255). 사진은 이 자리에 떠 있어(absolute)
            제 크기로 자리를 요구하지 않습니다 — 이름이 두 줄 · 메모가 세 줄인 향수에서도 카드가 제
            자리(1920 에서 710)를 넘지 않고 병이 그만큼 작아집니다. 예전에는 255 로 못 박아 두고 "메모
            세 줄까지 재고 정한 값" 이라 적어 두었는데, 무엇을 더하든 넘칠 자리였습니다.
            두 단으로 넓게 설 때(쌓는 배치)는 사진과 글이 좌우로 갈라져 시안의 180 그대로 둡니다.

            병 이미지는 배경이 투명한 PNG 로 들어옵니다(DisplayCase 와 같은 소스). 그래서 Thumbnail 을
            쓰지 않습니다 — 자리표시자 상자의 테두리·배경이 투명 영역을 네모로 드러냅니다.
            고른 병의 사진이라 먼저 받고(fetchPriority high) 그 자리에서 풀어 그립니다(decoding sync).
            벽의 그 병과 같은 주소라 이미 받아 둔 사진을 씁니다. 병을 바꿀 때마다 key 로 새로 그려서,
            비동기로 풀면 사진 자리가 한 프레임 비었다 채워집니다.
          */}
          <div className="shelf-sheet-bottle @xl:h-45 @xl:max-h-none @xl:min-h-0 @xl:flex-none">
            {item.thumbnailUrl && (
              <img
                src={item.thumbnailUrl}
                alt=""
                fetchPriority="high"
                decoding="sync"
                className="shelf-bottle-img"
              />
            )}
          </div>

          <div className="flex flex-col items-center gap-1.25">
            <p className="shelf-sheet-label">{item.brand}</p>

            {/*
              **국문 이름을 크게 적고 그 위에 영문 이름을 한 줄 답니다.** 백엔드가 주는 `name` 이 영문이고
              `nameKo` 가 국문이라 읽는 사람에게 익숙한 쪽을 크게 둡니다. 국문 이름이 없는 향수는 영문
              한 줄만 크게 적습니다 — 빈 줄을 남기지 않습니다.

              이름을 누르면 향수 상세(A10)로 갑니다. 진열대에서 상세로 가는 유일한 길이라 **두 줄을 한
              링크로 묶습니다** — 영문 이름은 국문을 되풀이하는 장식이라 낭독기에서 빼 두었고
              (aria-hidden), 그 줄만 링크로 만들면 낭독기가 이름 없는 링크를 읽게 됩니다.
              향수명을 heading 태그로 두지 않은 것은 이 패널이 놓이는 자리에 따라 제목 단계가 달라지기
              때문입니다. 대신 aside 에 aria-label 을 달아 낭독기가 영역을 찾을 수 있게 했습니다.
            */}
            <Link
              to={toPerfumeDetail(item.perfumeId)}
              state={perfumeViewState('SHELF')}
              className={cn(
                'flex flex-col items-center gap-1.25 rounded-md',
                'hover:underline hover:underline-offset-4',
                FOCUS_RING,
              )}
            >
              {item.nameKo && (
                <span className="shelf-muted text-body" aria-hidden lang="en">
                  {item.name}
                </span>
              )}
              <span
                className="shelf-sheet-name font-serif"
                lang={item.nameKo ? undefined : 'en'}
              >
                {item.nameKo ?? item.name}
              </span>
            </Link>
          </div>

          {/*
            취향 적합도 (SHF-12 · DTL-18 · DTL-19). 원 다섯 개의 좌우 반쪽을 눌러
            1.0 ~ 5.0 을 0.5 단위로 고릅니다 — 첫 원만 반이 없습니다(0.5 는 백엔드가
            받지 않습니다). 그 규칙과 화살표 키 이동은 공용 StarRating 이 들고 있습니다.

            숫자는 끕니다(showValue={false}) — 값은 낭독기에 글자로 남습니다. 원 앞의 작은 말은 원이
            무엇인지 알려 주는 이름표라 낭독기에서는 뺍니다(원 묶음의 이름이 같은 말입니다).
          */}
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="shelf-muted text-caption">
              내 취향 적합도
            </span>
            <StarRating
              label="내 취향 적합도"
              value={item.rating}
              onChange={onChangeRating}
              showValue={false}
              size="lg"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3.75 @xl:flex-1">
          <ScentNotes item={item} pending={pending} />

          {/*
            조작과 메모. 두 단으로 설 때는 mt-auto 로 카드 맨 아래에 붙입니다.

            단추 둘은 편지의 단추와 같은 짜임입니다(높이 40 · 모서리 6 · 오른쪽이 주된 일). 주된 일인
            [변경하기] 가 먹 단추이고, 되돌릴 수 없는 [저장 해제] 는 **경고색 테두리 단추**입니다 — 예전에는
            경고색으로 꽉 채워 카드에서 가장 무거운 덩어리가 되돌릴 수 없는 단추였습니다. 색이 경고를
            맡는 것은 그대로입니다. 확인창은 화면(pages)이 띄웁니다.

            공용 Button 을 씁니다. 직접 만들면 모서리·굵기·포커스 링·전환·비활성 규칙을 그대로 베껴
            적게 되는데, 나중에 공용 쪽이 바뀔 때 이 버튼만 뒤처집니다. 높이 · 모서리 · 색만 덮습니다
            — cn(twMerge)이 variant·size 의 겹치는 값을 걷어냅니다.
          */}
          <div className="flex flex-col gap-3.75 @xl:mt-auto">
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={onRemove}
                className={cn(
                  'border-danger/40 text-danger hover:bg-danger/5 h-10 rounded-md',
                  FOCUS_RING,
                )}
              >
                저장 해제
              </Button>
              <Button
                size="sm"
                fullWidth
                onClick={onEdit}
                className={cn('h-10 rounded-md', FOCUS_RING)}
              >
                변경하기
              </Button>
            </div>

            <MemoField item={item} pending={pending} />
          </div>
        </div>
      </div>
    </aside>
  )
}

/**
 * 향조 — 상세 응답의 실제 노트를 탑 · 미들 · 베이스 줄로 묶어 적습니다(lib.ts 의 noteRows).
 *
 * 줄마다 노트 셋까지 적고 넘치면 "외 N" 입니다. 줄 머리의 단계 이름은 자간 넓힌 대문자이고, 피라미드가
 * 없는 향수(flat)는 이름표 없이 노트만 한 줄입니다. 노트 이름은 받은 그대로(영문)입니다 — 향수
 * 상세의 향조 칸과 같은 말입니다.
 *
 * 상세가 오는 중이면(pending) 탑 · 미들 · 베이스 세 줄을 빈 줄로 세워 둡니다. 대개 세 줄로 오므로
 * 도착해도 아래 단추 · 메모가 움직이지 않습니다.
 */
function ScentNotes({
  item,
  pending,
}: {
  item: ShelfItemDetail
  pending: boolean
}) {
  const rows = noteRows(item.scentNotes)

  return (
    <div className="flex flex-col gap-2">
      <p className="shelf-sheet-heading" lang="en">
        Scent note
      </p>
      {pending ? (
        <dl aria-busy className="shelf-sheet-notes">
          {NOTE_STAGES.map((stage) => (
            <Fragment key={stage}>
              <dt>{stage}</dt>
              <dd>
                <span aria-hidden className="shelf-sheet-skeleton" />
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : rows.length === 0 ? (
        <p className="shelf-muted text-body">
          향조 정보가 아직 등록되지 않았어요
        </p>
      ) : (
        <dl className="shelf-sheet-notes">
          {rows.map((row) => {
            const shown = row.names.slice(0, NOTES_PER_ROW)
            const more = row.names.length - shown.length
            return (
              <Fragment key={row.stage}>
                {row.label !== null && <dt>{row.label}</dt>}
                <dd
                  data-wide={row.label === null ? '' : undefined}
                  title={row.names.join(', ')}
                >
                  {shown.join(' · ')}
                  {more > 0 && <span className="shelf-muted"> 외 {more}</span>}
                </dd>
              </Fragment>
            )
          })}
        </dl>
      )}
    </div>
  )
}

/**
 * 개인 메모 — **읽기 전용**입니다.
 *
 * ⚠️ 메모는 향수 한 개당 하나입니다(와이어프레임 A15 주석). 향수 상세의 후기와는
 * 별개고, 남에게 보이지 않습니다.
 *
 * 예전에는 여기 "수정" 단추가 있어 카드 안에서 바로 고쳤습니다. 지금은 분류 ·
 * 적합도 · 메모를 [변경하기] 모달 한 자리에서 고치므로 입구를 하나로 모았습니다 —
 * 같은 값을 고치는 길이 둘이면 한쪽만 쓰이고 다른 쪽은 잊힙니다.
 *
 * 가는 선 아래에 섭니다 — 편지의 발치(다른 향수 추천받기)와 같은 자리입니다. 적은 글은 명조로 적어
 * 손으로 적어 둔 쪽지처럼 읽히게 하고, 비어 있을 때의 안내는 본문 글꼴 그대로입니다.
 *
 * 세 줄에서 자릅니다(line-clamp-3). 카드 높이가 벽감에 맞춰져 있어서 긴 메모를 다
 * 펼치면 카드가 벽감 아래로 흘러내려 옆 병의 이름표를 덮습니다. 잘린 뒷부분은
 * [변경하기] 를 열면 입력칸에서 전부 보입니다.
 *
 * **글자는 caption(12) 이 아니라 heading(16) 입니다.** 이 카드는 통째로
 * `zoom: var(--panel-scale)` 로 줄어서, 1920 에서도 12px 이 11.5px 로 그려집니다.
 * 활자 스케일의 하한(12px — 한글은 그 아래로 급격히 읽기 힘들어집니다)을 화면에서
 * 이미 밑돌던 자리라, 카드가 줄어드는 만큼 한 단 위에서 시작합니다.
 */
function MemoField({
  item,
  pending,
}: {
  item: ShelfItemDetail
  pending: boolean
}) {
  const memo = item.memo ?? ''
  const writtenAt = formatShelfDate(item.memoUpdatedAt)

  /*
    향조 칸과 같은 제목줄(MEMO ─── 쓴 날) 아래 옅은 쪽지 상자에 적습니다. 가는 선 위 이름표와 옅은
    한 줄로만 두면 카드 맨 아래 각주처럼 묻혀, 사용자가 적은 글이 카드에서 가장 안 보였습니다.
    적은 메모는 먹 명조, 비었을 때의 안내는 한 단 옅은 명조입니다.
  */
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <p className="shelf-sheet-heading flex-1" lang="en">
          Memo
        </p>
        {writtenAt && (
          <span className="shelf-muted text-caption tabular-nums">
            {writtenAt}
          </span>
        )}
      </div>

      <div className="shelf-sheet-note">
        {pending ? (
          <span aria-hidden className="shelf-sheet-skeleton" />
        ) : (
          <p
            className={cn(
              'text-heading line-clamp-3 font-serif leading-[1.6] whitespace-pre-line',
              !memo && 'shelf-muted',
            )}
          >
            {memo || '이 향을 어디서 언제 맡았는지 적어두세요.'}
          </p>
        )}
      </div>
    </div>
  )
}
