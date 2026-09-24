import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import type { CollectionPerfume } from '../types'

import {
  CaseBottles,
  CaseInside,
  CaseNiche,
  CasePlate,
  NewCaseMark,
} from './CaseNiche'

type Props = {
  perfumes: CollectionPerfume[]
  /** 칸의 [×]. 진열대 저장은 그대로 두고 이 컬렉션에서만 뺍니다 */
  onRemove: (perfume: CollectionPerfume) => void
  /** 마지막 빈 칸 — 진열대의 향수를 더 담습니다 */
  onAdd: () => void
  className?: string
}

/**
 * 컬렉션 상세의 향수 칸 (A17). 향수마다 한 병이 서는 세로 진열함이고, 아래 명판에 브랜드와 이름을
 * 적습니다. 칸을 누르면 향수 상세로 가고, 오른쪽 위 [×] 로 이 컬렉션에서 뺍니다. 마지막 칸은 빈
 * 진열함이라 누르면 향수를 더 담습니다 — 내 컬렉션 무대의 "새 컬렉션" 칸과 같은 자리 · 같은 모양입니다.
 *
 * 칸 최소 폭은 1920 에서 200 입니다 — 넓은 화면 오른쪽 기둥에 다섯 칸, 1024 · 768 셋. 휴대폰(~639)은
 * 두 칸으로 못 박습니다 — 최소 폭으로 세면 한 칸이 되어 병 하나가 화면 한 장을 차지합니다.
 */
export function CollectionPerfumeGrid({
  perfumes,
  onRemove,
  onAdd,
  className,
}: Props) {
  return (
    <ul
      className={cn(
        'grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-[repeat(auto-fill,minmax(calc(var(--spacing)*50),1fr))] sm:gap-x-7.5',
        className,
      )}
    >
      {perfumes.map((perfume) => (
        <li key={perfume.shelfItemId} className="relative min-w-0">
          <Link
            to={toPerfumeDetail(perfume.perfumeId)}
            state={perfumeViewState('COLLECTION')}
            className="collection-case block outline-none"
          >
            <CaseNiche shape="tall">
              <CaseBottles sources={[perfume.thumbnailUrl]} />
            </CaseNiche>
            <CasePlate
              size="sm"
              // 브랜드가 비어 있는 향수가 있습니다 — 줄자리는 남겨 칸마다 명판 높이가 같습니다
              kicker={perfume.brand ?? <span aria-hidden>&nbsp;</span>}
              title={perfume.name}
            />
          </Link>
          {/*
            링크 밖에 둡니다 — 누를 것 안에 누를 것을 넣으면 낭독기가 둘을 한 덩어리로 읽고, [×] 를
            누를 때 링크까지 눌립니다. 자리만 진열함 오른쪽 위로 겹쳐 올립니다.
          */}
          <button
            type="button"
            aria-label={`${perfume.name} 컬렉션에서 제거`}
            onClick={() => onRemove(perfume)}
            className="collection-remove"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.25">
              <path
                d="M4 4l8 8M12 4l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </li>
      ))}

      <li className="min-w-0">
        <button
          type="button"
          onClick={onAdd}
          className="collection-case block w-full outline-none"
        >
          <CaseNiche shape="tall">
            <CaseInside>
              <NewCaseMark />
            </CaseInside>
          </CaseNiche>
          <CasePlate
            size="sm"
            // 향수 칸의 브랜드 자리 — 자간을 넓힌 영문 대문자라 한글을 적으면 글자가 흩어지고, 길면 좁은
            // 명판(휴대폰 · 1440 아래에서 글 폭 100 남짓)에서 잘립니다
            kicker={<span lang="en">From shelf</span>}
            title={perfumes.length === 0 ? '첫 향수 담기' : '향수 더 담기'}
          />
        </button>
      </li>
    </ul>
  )
}
