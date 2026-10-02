/**
 * 3D 엔진이 들고 있는 지도 향수 목록의 타입 선언.
 *
 * 실체는 `landing/src/perfumes-data.js` 이고 `data/perfume_map_points.csv` 에서
 * 생성됩니다(`landing/scripts/perfumes-from-csv.mjs`). 엔진은 순수 JS 라 타입이
 * 없어서, 앱이 읽는 필드만 여기에 적습니다. 경로 별칭 `@landing` 은
 * `vite.config.ts` 의 `resolve.alias` 에 있습니다.
 *
 * ⚠️ **앱이 쓰는 필드만 적었습니다.** 실제 데이터에는 `nb`(닮은 향수 10개) 같은
 * 엔진 전용 필드가 더 있습니다 — 앱이 안 쓰므로 선언하지 않습니다.
 * ⚠️ tsconfig 의 `include` 는 `src` 뿐이라 엔진 파일 자체는 타입 검사 대상이
 *    아닙니다. 이 선언과 실제 데이터가 어긋나도 컴파일러는 모릅니다. CSV 스키마가
 *    바뀌면 여기도 같이 봅니다.
 */
declare module '@landing/perfumes-data' {
  interface EnginePerfume {
    /** fragrantica_id — **DB 향수 번호가 아닙니다** */
    id: number
    brand: string
    name: string
    /** 한글 이름 · 브랜드. CSV 에 없으면 빈 문자열입니다 */
    nameKo: string
    brandKo: string
    /** 지도에 찍는 짧은 이름 (긴 제품명을 줄인 것) */
    labelKo: string
    /** 향 계열 코드 — `shared/config/scentFamilies` 의 아홉과 같은 값 */
    family: string
    /** 정규화 좌표 0~1 (엔진 `scentmap.js` 가 월드로 옮깁니다) */
    mx: number
    my: number
  }

  export const PERFUMES: EnginePerfume[]
}
