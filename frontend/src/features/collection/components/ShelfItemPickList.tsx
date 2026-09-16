import { Checkbox } from '@/shared/ui/Checkbox'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SearchField } from '@/shared/ui/SearchField'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/**
 * 고를 수 있는 진열대 항목 한 줄.
 *
 * **번호가 `shelfItemId` 입니다.** 컬렉션은 향수가 아니라 내 진열대 항목을 담기
 * 때문에, 담고 빼는 요청이 전부 이 번호를 씁니다. `perfumeId` 로는 지울 수 없습니다.
 */
export type ShelfItemCandidate = {
  shelfItemId: number
  perfumeId: number
  name: string
  /** 브랜드가 비어 있는 향수가 있습니다 */
  brand: string | null
  thumbnailUrl?: string | null
}

type Props = {
  candidates: ShelfItemCandidate[]
  /** 고른 진열대 항목 번호들 */
  picked: number[]
  onToggle: (shelfItemId: number) => void
  onSearch: (keyword: string) => void
  /** 후보가 하나도 없을 때 할 말. 만들 때와 담을 때가 다릅니다 */
  emptyTitle: string
}

/**
 * 진열대에서 향수를 골라 담는 목록 (와이어프레임 A19 — COL-01 · COL-03)
 *
 * 두 모달이 같은 목록을 씁니다. 컬렉션 만들기와 향수 추가인데, 고르는 대상과
 * 규칙("진열대에 없는 향수는 추가 불가")이 같습니다. 따로 적어 두면 한쪽에만
 * 검색이 붙거나 빈 화면 문구가 달라집니다.
 *
 * 값을 들고 있지 않습니다(controlled) — 고른 뒤에 벌어지는 일이 모달마다 달라서
 * (만들기는 `POST /collections`, 추가는 `POST .../perfumes`) 그 판단은 부르는 쪽에 둡니다.
 */
export function ShelfItemPickList({
  candidates,
  picked,
  onToggle,
  onSearch,
  emptyTitle,
}: Props) {
  return (
    <>
      <SearchField
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드 검색"
        onSearch={onSearch}
      />

      {candidates.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description="진열대에 저장한 향수만 컬렉션에 넣을 수 있습니다."
        />
      ) : (
        <ul className="max-h-72.5 space-y-1.25 overflow-y-auto">
          {candidates.map((candidate) => (
            <li key={candidate.shelfItemId}>
              <label className="hover:bg-line-soft flex cursor-pointer items-center gap-2.5 p-2.5">
                <Checkbox
                  checked={picked.includes(candidate.shelfItemId)}
                  onChange={() => onToggle(candidate.shelfItemId)}
                />
                <Thumbnail
                  src={candidate.thumbnailUrl}
                  className="size-10 shrink-0"
                />
                <span className="min-w-0">
                  <span className="text-ink text-body block truncate font-medium">
                    {candidate.name}
                  </span>
                  <span className="text-ink-muted text-caption block truncate">
                    {candidate.brand}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <p className="text-ink-muted text-caption">
        {picked.length}개 선택됨 · 진열대에 없는 향수는 추가할 수 없습니다.
      </p>
    </>
  )
}
