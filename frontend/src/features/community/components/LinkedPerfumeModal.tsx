import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { SearchField } from '@/shared/ui/SearchField'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { LinkedPerfume } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  /** 검색 결과. 화면(pages)에서 향수 도메인 데이터를 넘겨주세요. */
  candidates: LinkedPerfume[]
  onSearch: (keyword: string) => void
  onSubmit: (perfumes: LinkedPerfume[]) => void
  /** 하나만 고르게 합니다(후기는 향수 한 개에 씁니다) */
  single?: boolean
  /** 검색 결과를 기다리는 중 */
  isPending?: boolean
}

/**
 * 글에 연결할 향수 선택 모달 (C02 — A24b 의 관련 향수 선택)
 *
 * 후보 목록은 화면에서 넘겨받습니다 — features 끼리는 import 할 수 없습니다.
 */
export function LinkedPerfumeModal({
  open,
  onClose,
  candidates,
  onSearch,
  onSubmit,
  single = false,
  isPending = false,
}: Props) {
  const [picked, setPicked] = useState<LinkedPerfume[]>([])

  /*
    한 번이라도 검색했는지. 후보 0개가 두 경우(아직 안 찾음 · 찾았는데 없음)라
    구분합니다. 닫아도 되돌리지 않습니다 — `<dialog>` 라 언마운트되지 않아 다시
    열면 지난 검색어가 칸에 남고, 안내만 되돌리면 칸의 글자와 어긋납니다.
  */
  const [searched, setSearched] = useState(false)

  const search = (keyword: string) => {
    setSearched(keyword.trim().length > 0)
    onSearch(keyword)
  }

  const toggle = (perfume: LinkedPerfume) => {
    if (single) {
      setPicked([perfume])
      return
    }

    setPicked((prev) =>
      prev.some((item) => item.perfumeId === perfume.perfumeId)
        ? prev.filter((item) => item.perfumeId !== perfume.perfumeId)
        : [...prev, perfume],
    )
  }

  /*
    `Modal` 이 `<dialog>` 라 닫아도 언마운트되지 않습니다. 비우지 않으면 다음에
    열었을 때 지난번에 고른 향수가 그대로 남습니다.
  */
  const close = () => {
    setPicked([])
    onClose()
  }

  const isPicked = (perfume: LinkedPerfume) =>
    picked.some((item) => item.perfumeId === perfume.perfumeId)

  return (
    <Modal
      open={open}
      onClose={close}
      title="향수 선택"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            취소
          </Button>
          <Button
            disabled={picked.length === 0}
            onClick={() => {
              onSubmit(picked)
              setPicked([])
            }}
          >
            선택
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <SearchField
          label="향수명 또는 브랜드명으로 검색"
          placeholder="향수명 · 브랜드 검색"
          onSearch={search}
        />

        {isPending ? (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <li key={index}>
                <Skeleton className="aspect-[1/1.35] w-full" />
              </li>
            ))}
          </ul>
        ) : candidates.length === 0 ? (
          <EmptyState
            title={searched ? '향수를 찾지 못했습니다' : '향수를 검색해 주세요'}
            description={
              searched
                ? '검색어를 바꿔 보세요.'
                : '향수명이나 브랜드명을 입력하면 고를 수 있는 향수가 나옵니다.'
            }
          />
        ) : (
          /*
            한 줄에 넷입니다. 사진을 3:4 로 세우면서 카드가 길어져(모달 폭 510 ·
            셋일 때 243), `max-h-90`(360) 안에 한 줄 반밖에 안 들어왔습니다 — 다음
            줄이 절반쯤 잘린 채 떠 있습니다. 넷으로 나누면 카드가 190 으로 줄어
            한 줄과 다음 줄의 대부분이 보입니다. (진열대 등록 모달(A15)은 아직 셋입니다.)

            여럿 고를 때도 체크박스를 두지 않습니다 — 카드 자체가 누르는 자리이고,
            고른 것은 테두리와 `aria-pressed` 로 알립니다. 카드 안에 체크박스를 또
            두면 사진을 누를지 네모를 누를지 헷갈립니다.
          */
          <ul className="grid max-h-90 grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-4">
            {candidates.map((candidate) => (
              <li key={candidate.perfumeId}>
                <button
                  type="button"
                  aria-pressed={isPicked(candidate)}
                  onClick={() => toggle(candidate)}
                  className={cn(
                    'w-full border p-2.5 text-left',
                    'transition-colors duration-120 ease-out',
                    'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                    isPicked(candidate)
                      ? 'border-accent bg-line-soft'
                      : 'border-line hover:border-accent',
                  )}
                >
                  <Thumbnail
                    src={candidate.thumbnailUrl}
                    fallback="이미지"
                    className="text-caption mb-2.5 aspect-3/4 w-full"
                  />
                  <span className="text-ink text-body block truncate font-medium">
                    {candidate.name}
                  </span>
                  <span className="text-ink-muted text-caption block truncate">
                    {candidate.brand}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-ink-muted text-caption">
          {single
            ? (picked[0]?.name ?? '고른 향수가 없습니다')
            : `${picked.length}개 선택됨`}
        </p>
      </div>
    </Modal>
  )
}
