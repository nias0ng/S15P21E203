import type { PerfumeOption, ShelfItem } from './types'

/**
 * 진열대 향수를 "고를 수 있는 향수" 모양으로 바꿉니다.
 *
 * 진열대 등록 모달(A15)과 컬렉션 향수 추가 모달(A19)이 똑같은 네 필드를 받는데,
 * 두 모달이 서로 다른 도메인에 있어서 화면(pages)마다 같은 map 을 손으로 적고
 * 있었습니다. 필드가 하나 늘면 두 화면을 다 찾아 고쳐야 하고, 한쪽만 고치면
 * 모달이 조용히 빈 값을 받습니다.
 *
 * 함수를 진열대 도메인에 두는 이유: 후보를 만들어 내는 쪽이 언제나 진열대이기
 * 때문입니다. "진열대에 없는 향수는 컬렉션에 추가할 수 없다"(A19 주석)가 그 규칙이고,
 * 이 함수가 그 규칙의 유일한 통로입니다.
 */
export function toPerfumeOption(item: ShelfItem): PerfumeOption {
  return {
    perfumeId: item.perfumeId,
    name: item.name,
    brand: item.brand,
    thumbnailUrl: item.thumbnailUrl,
  }
}

/**
 * 메모를 마지막으로 쓴 날을 `YYYY.MM.DD` 로 적습니다.
 *
 * 백엔드는 UTC ISO 를 주는데 그대로 보여주면 `2026-08-20T00:00:00Z` 가 화면에
 * 그대로 찍힙니다. **보는 사람의 지역 날짜**로 옮겨서 적습니다 — UTC 로 자르면
 * 한국에서 밤 9시 이후에 쓴 메모가 다음 날로 보입니다.
 *
 * `shared/lib` 이 아니라 여기 두는 이유: 지금 부르는 곳이 진열대 한 곳뿐입니다.
 * 두 번째 도메인이 같은 표기를 쓰게 되면 그때 `shared/lib` 으로 올립니다
 * (CLAUDE.md — "예상해서 미리 shared 에 올리지 않습니다").
 */
export function formatShelfDate(iso: string | null): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}.${pad(at.getMonth() + 1)}.${pad(at.getDate())}`
}
