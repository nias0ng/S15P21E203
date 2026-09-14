import type { ScentVector } from './types'

/**
 * ⚠️ 백엔드 향 지도 API 가 아직 없습니다.
 *
 * 향수 200개의 계열 벡터와 좌표는 `backend/db/seed` 에 이미 들어와 있지만
 * (`perfume_map_points` · `perfume_map_families`, V6 스키마) 이를 내려주는
 * 엔드포인트가 없어 `data/scentVectors.ts` 스냅샷을 대신 씁니다.
 *
 * API 가 생기면 아래 함수 본문만 바꾸면 됩니다. 화면과 `queries.ts` 는 그대로입니다.
 *
 *   export async function getScentVectors(): Promise<ScentVector[]> {
 *     const { data } = await http.get<ScentVector[]>('/map/scent-vectors')
 *     return data
 *   }
 *
 * ⚠️ 그때까지 `perfumeId` 는 진짜 향수 id 가 아니라 `fragrantica_id` 입니다.
 * 시드 적재 스크립트가 `perfumes` 와 조인해 바꿔 넣는 값이라 프런트에서는 알 수 없습니다.
 * 지도에서 이 id 로 향수를 찾지 못해도 화면이 죽지 않게 처리해야 합니다.
 */
export async function getScentVectors(): Promise<ScentVector[]> {
  // 온보딩에서만 쓰는 20KB 짜리 데이터라 첫 진입 번들에서 떼어냅니다.
  const { SCENT_VECTOR_SNAPSHOT } = await import('./data/scentVectors')

  return SCENT_VECTOR_SNAPSHOT.map((row) => ({
    perfumeId: row.fragranticaId,
    x: row.x,
    y: row.y,
    rank: row.rank,
    families: row.families,
  }))
}
