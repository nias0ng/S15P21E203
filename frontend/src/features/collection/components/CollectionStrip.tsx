import { Link } from 'react-router'

import { toCollectionDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import type { CollectionSummary } from '../types'

import {
  CaseBottles,
  CaseInside,
  CaseNiche,
  CasePlate,
  NewCaseMark,
} from './CaseNiche'
import { CollectionNotice } from './CollectionNotice'

type Props = {
  items: CollectionSummary[]
  isPending?: boolean
  /** 목록을 못 받았을 때. 격자 대신 까닭과 다시 부르는 단추가 섭니다 */
  isError?: boolean
  onRetry?: () => void
  onCreate: () => void
  /**
   * 무대 높이에 두 줄이 다 들도록 칸 수를 고릅니다 — 높이가 정해진 한 장 배치의 무대에서만 켭니다.
   * 부모(스크롤 칸)가 높이를 정해 줘야 합니다. 쌓는 배치는 페이지가 스크롤되어 끕니다.
   */
  fitRows?: boolean
  className?: string
}

/** 목록이 오는 동안 세워 두는 빈 진열함 수 — 넓은 화면의 한 줄입니다 */
const PENDING_CASES = 4

/**
 * 내 컬렉션 — 진열함 격자 (A13 하단 무대)
 *
 * 컬렉션 하나가 벽에 판 **작은 벽감(진열함) 하나**입니다. 담긴 향수 앞의 세 병이 진열대처럼 바닥에
 * 서고, 아래 명판에 이름과 개수 · 설명이 적힙니다. 마지막 칸은 빈 진열함이라 누르면 새 컬렉션을
 * 만듭니다.
 *
 * 칸은 무대 폭을 따라 늘고 줄어 무대 제목과 같은 왼쪽 선에서 시작합니다. 벽감의 색은 진열대 팔레트를
 * 빌립니다 — 진열대 화면(.shelf-scope) 안에서만 씁니다(collection-cabinet.css 머리말).
 */
export function CollectionStrip({
  items,
  isPending = false,
  isError = false,
  onRetry,
  onCreate,
  fitRows = false,
  className,
}: Props) {
  /*
    칸의 최소 폭은 1920 에서 380 입니다 — 1920 · 1440 에서 네 칸, 1024 둘, 휴대폰 하나.
    400 이면 1440 이 세 칸이 되어 둘째 줄 명판이 하단 띠에 걸립니다. 칸이 적어도 늘이지 않고
    (auto-fill) 왼쪽부터 채웁니다 — 한두 개일 때 진열함이 화면 폭만큼 부풀지 않게.
    무대 높이에 맞출 때(fitRows)는 최소 폭을 CSS 가 무대 높이로 셉니다(--cabinet-col —
    collection-cabinet.css 의 "무대 높이에 두 줄").
  */
  const grid = cn(
    'collection-grid grid grid-cols-[repeat(auto-fill,minmax(var(--cabinet-col,calc(var(--spacing)*95)),1fr))] gap-x-10 gap-y-10',
    className,
  )
  const fit = (node: React.ReactNode) =>
    fitRows ? <div className="collection-fit">{node}</div> : node

  /*
    못 받았으면 빈 격자로 그리지 않습니다 — 아무 말이 없으면 "컬렉션이 하나도 없다" 로 읽히는데,
    실제로는 못 읽어 온 것입니다. 진열대처럼 화면 전체를 대신하지 않고 이 무대 자리에만 안내를 둡니다.
  */
  if (isError) {
    return (
      <CollectionNotice
        title="컬렉션을 불러오지 못했습니다"
        description="잠시 후 다시 시도해 주세요."
        onRetry={onRetry}
      />
    )
  }

  // 오는 동안은 빈 진열함과 명판 자리만 — 병 윤곽을 세우면 없는 병이 선 것처럼 읽힙니다
  if (isPending) {
    return fit(
      <div aria-hidden className={grid}>
        {Array.from({ length: PENDING_CASES }, (_, index) => (
          <div key={index}>
            <CaseNiche />
            <CasePlate
              // 명판은 글 폭만큼 줄어드는 상자라 막대 폭을 %가 아니라 고정 값으로 줍니다
              title={<span className="collection-plate-bar w-35" />}
              meta={<span className="collection-plate-bar w-55" />}
            />
          </div>
        ))}
      </div>,
    )
  }

  return fit(
    <ul className={grid}>
      {items.map((collection) => (
        <li key={collection.collectionId} className="min-w-0">
          <CollectionCase collection={collection} />
        </li>
      ))}

      <li className="min-w-0">
        <button
          type="button"
          onClick={onCreate}
          className="collection-case block w-full outline-none"
        >
          <CaseNiche>
            <CaseInside>
              <NewCaseMark />
            </CaseInside>
          </CaseNiche>
          <CasePlate
            title={items.length === 0 ? '첫 컬렉션 만들기' : '새 컬렉션'}
            meta="진열대의 향수를 골라 한 상자에 묶어 둡니다"
          />
        </button>
      </li>
    </ul>,
  )
}

/** 컬렉션 하나 — 진열함 + 명판. 누르면 컬렉션 상세로 갑니다 */
function CollectionCase({ collection }: { collection: CollectionSummary }) {
  const { previewThumbnails: bottles, description } = collection

  return (
    <Link
      to={toCollectionDetail(collection.collectionId)}
      className="collection-case block outline-none"
    >
      <CaseNiche>
        {bottles.length > 0 ? (
          <CaseBottles sources={bottles} />
        ) : (
          /*
            향수를 다 빼면 빈 컬렉션이 남습니다(만들 때는 서버가 한 병 이상을 받습니다).
            빈 진열함만 두면 새 컬렉션 칸과 구별이 안 돼서 비어 있다고 적습니다.
          */
          <CaseInside>
            <span className="shelf-muted text-body font-serif">
              아직 담긴 향수가 없어요
            </span>
          </CaseInside>
        )}
      </CaseNiche>
      <CasePlate
        title={collection.title}
        meta={
          <>
            <span className="tabular-nums">
              향수 {collection.perfumeCount}개
            </span>
            {description && <> · {description}</>}
          </>
        }
      />
    </Link>
  )
}
