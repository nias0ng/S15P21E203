import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { BottleSilhouette } from '@/shared/ui/BottleSilhouette'

/*
 * 진열함 조각 — 내 컬렉션 무대(CollectionStrip) · 컬렉션 상세(CollectionPerfumeGrid) · 향수 고르기
 * (ShelfItemPickList)가 같이 씁니다. 모양은 collection-cabinet.css 가 칠합니다.
 */

type NicheProps = {
  /**
   * 상자 비율. `wide`(8:5)는 병 셋이 서는 컬렉션 진열함, `tall`(3:4)은 한 병이 서는 칸,
   * `square`(1:1)는 모달에서 향수를 고르는 칸입니다(세로가 짧아 한 화면에 두 줄 남짓 섭니다).
   */
  shape?: 'wide' | 'tall' | 'square'
  /** 모달 안의 작은 칸 — 면 깊이를 얕게 해 작은 상자에서도 벽이 병을 누르지 않습니다 */
  compact?: boolean
  children?: ReactNode
}

/**
 * 벽에 판 작은 벽감. 면(뒷벽 · 빛 · 천장 · 좌우 벽 · 바닥 · 입구 테두리 · 결)을 한 겹씩 칠하고,
 * 그 위에 병이나 글을 세웁니다(children).
 */
export function CaseNiche({
  shape = 'wide',
  compact = false,
  children,
}: NicheProps) {
  return (
    <span
      className="collection-niche"
      data-shape={shape}
      data-compact={compact ? '' : undefined}
    >
      <i className="collection-niche-back" />
      <i className="collection-niche-light" />
      <i className="collection-niche-ceiling" />
      <i className="collection-niche-wall-left" />
      <i className="collection-niche-wall-right" />
      <i className="collection-niche-floor" />
      <i className="collection-niche-bevel" />
      <i className="collection-niche-grain" />
      {children}
    </span>
  )
}

/** 진열함 바닥에 나란히 서는 병들. 모두 같은 높이로 서고 가운데로 모입니다 */
export function CaseBottles({ sources }: { sources: (string | null)[] }) {
  return (
    <span className="collection-bottles">
      {sources.map((src, at) => (
        // 사진이 바뀌면 새로 세웁니다 — 옛 병에 걸린 data-ready 가 남으면 새 사진을 드러내지 않고 바로 그립니다
        <CaseBottle key={`${at}:${src ?? ''}`} src={src} />
      ))}
    </span>
  )
}

/**
 * 진열함 바닥에 선 병 한 병. 사진이 없는 향수는 진열대처럼 실루엣을 세우고, 접지 그림자는 같이 둡니다.
 *
 * 사진은 다 받은 뒤에 드러냅니다(data-ready) — 받는 중에 그리면 병이 위에서부터 한 줄씩 찹니다.
 * data-ready 는 React 가 아니라 받은 순간 DOM 에 직접 겁니다(진열대의 useBottlePreload 와 같은 길).
 */
function CaseBottle({ src }: { src: string | null }) {
  if (src === null) {
    return (
      <span className="collection-bottle" data-ready="">
        <i className="collection-bottle-contact" />
        <BottleSilhouette className="collection-bottle-img aspect-1/2 text-[var(--niche-floor)]" />
      </span>
    )
  }

  const reveal = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) {
      img.parentElement?.setAttribute('data-ready', '')
    }
  }

  return (
    <span
      className="collection-bottle"
      style={{ '--bottle': `url("${src}")` } as React.CSSProperties}
    >
      <i className="collection-bottle-contact" />
      {/* 벽에 지는 그림자 — drop-shadow 가 아니라 같은 실루엣을 오른쪽 뒤로 민 층입니다 */}
      <i className="collection-bottle-cast" />
      <img
        ref={reveal}
        src={src}
        alt=""
        decoding="async"
        onLoad={(event) => reveal(event.currentTarget)}
        className="collection-bottle-img"
      />
    </span>
  )
}

/** 뒷벽 한가운데에 세우는 글 · 표시 — 빈 컬렉션의 안내, 새 칸의 십자 */
export function CaseInside({ children }: { children: ReactNode }) {
  return <span className="collection-case-inside">{children}</span>
}

/** 새 진열함 · 새 칸 표시 — 종이 원 안의 가는 십자. 누를 수 있는 칸에 마우스를 올리면 먹으로 채워집니다 */
export function NewCaseMark() {
  return <span aria-hidden className="collection-new-mark" />
}

type PlateProps = {
  /** 이름 위의 작은 줄 — 향수 칸의 브랜드 */
  kicker?: ReactNode
  title: ReactNode
  /** 이름 아래 한 줄 — 개수 · 설명 */
  meta?: ReactNode
  /**
   * `md` 는 컬렉션 진열함(이름 한 줄 + 설명 한 줄), `sm` 은 향수 칸(브랜드 + 이름 두 줄까지 · 좁은 판).
   * 이름은 둘 다 명조 16 입니다 — 크기가 아니라 짜임만 다릅니다(collection-cabinet.css 의 활자 단).
   */
  size?: 'md' | 'sm'
  className?: string
}

/**
 * 진열함 아래 명판 — 크림 종이에 안쪽 테두리선을 두른 판에 이름을 가운데로 적습니다.
 *
 * 벽(종이)에 바로 적지 않는 까닭: 종이는 물 겹 때문에 아래로 갈수록 한 단 어두워져 아랫줄 글이
 * 흐려지고, 병이 선 진열함 옆에서는 이름이 눈에 들어오지 않습니다. 명판은 제 바탕을 들고 있어 어디에
 * 서든 같은 대비로 읽힙니다. 진열함보다 조금 좁게 가운데에 달아 진열대의 메뉴판 · 이름표와 같은
 * 말투로 섭니다.
 */
export function CasePlate({
  kicker,
  title,
  meta,
  size = 'md',
  className,
}: PlateProps) {
  return (
    <span className={cn('collection-plate', className)} data-size={size}>
      {kicker && <span className="collection-plate-kicker">{kicker}</span>}
      {/* 안쪽 한 겹은 `sm` 에서 두 줄 자르기를 맡고, 바깥이 두 줄 자리 가운데에 세웁니다 */}
      <span className="collection-plate-title">
        <span>{title}</span>
      </span>
      {meta && <span className="collection-plate-meta">{meta}</span>}
    </span>
  )
}
