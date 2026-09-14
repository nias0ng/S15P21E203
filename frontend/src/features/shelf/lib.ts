import type { PerfumeOption, ShelfItem } from './types'

/**
 * 진열대 향수를 "고를 수 있는 향수" 모양으로 바꿉니다.
 *
 * 등록 모달(A15)과 컬렉션 추가 모달(A19)이 같은 네 필드를 받는데 서로 다른
 * 도메인에 있어서, 화면마다 같은 map 을 손으로 적으면 한쪽만 고쳤을 때 모달이
 * 조용히 빈 값을 받습니다.
 *
 * 진열대 도메인에 두는 이유: "진열대에 없는 향수는 컬렉션에 추가할 수 없다"(A19)가
 * 규칙이고 이 함수가 그 규칙의 유일한 통로입니다.
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
 * 백엔드가 UTC ISO 를 주는데 **보는 사람의 지역 날짜**로 옮깁니다 — UTC 로 자르면
 * 한국에서 밤 9시 이후에 쓴 메모가 다음 날로 보입니다.
 *
 * 부르는 곳이 진열대 하나뿐이라 `shared/lib` 이 아니라 여기 둡니다.
 */
export function formatShelfDate(iso: string | null): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}.${pad(at.getMonth() + 1)}.${pad(at.getDate())}`
}
