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
