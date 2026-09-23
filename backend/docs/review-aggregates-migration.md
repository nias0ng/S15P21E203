# 향수 상세 후기 집계 통합 안내

향수 상세 화면이 네 번 부르던 후기 집계를 한 번에 받을 수 있는 엔드포인트를 추가했습니다.
**기존 네 엔드포인트는 그대로 동작합니다.** 화면이 옮겨온 뒤에 지웁니다.

이 문서는 화면을 옮기는 쪽에 필요한 내용만 담았습니다. 배경은 [왜 합쳤는가](#6-왜-합쳤는가)에 있습니다.

## 1. 새 엔드포인트

```
GET /api/v1/perfumes/{perfumeId}/review-aggregates?size=20
```

- 인증이 필요 없습니다. 기존 네 엔드포인트와 같습니다.
- `size`는 **키워드 개수 상한**입니다. 기본 20, 최대 100. 나머지 세 조각에는 영향이 없습니다.
  `review-keywords`의 `size`와 완전히 같은 뜻입니다.
- 없는 향수와 비활성 향수는 `404 PERFUME_NOT_FOUND`입니다. 기존과 같습니다.

## 2. 무엇이 바뀌고 무엇이 그대로인가

**바뀌는 것은 읽는 위치 하나뿐입니다.** 네 조각은 각 단건 엔드포인트가 내려주던 응답
**그 자체**입니다. 필드 이름, 타입, 정렬 순서, 빈 값의 모양이 하나도 바뀌지 않았습니다.

| 기존 호출 | 새 응답에서 읽는 위치 |
| --- | --- |
| `GET .../review-summary` | `reviewSummary` |
| `GET .../review-keywords?size=N` | `reviewKeywords` (같은 요청의 `?size=N`) |
| `GET .../review-statistics` | `reviewStatistics` |
| `GET .../season-statistics` | `seasonStatistics` |

OpenAPI 문서에서도 네 필드가 기존과 **같은 스키마 컴포넌트**(`PerfumeReviewSummaryResponse`,
`PerfumeReviewKeywordsResponse`, `PerfumeReviewStatisticsResponse`,
`PerfumeSeasonStatisticsResponse`)를 참조합니다. 타입을 새로 정의하지 말고 지금 쓰는 네 타입을
그대로 묶어 쓰면 됩니다.

```ts
// 새로 정의할 것은 이 한 겹뿐입니다.
interface PerfumeReviewAggregatesResponse {
  reviewSummary: PerfumeReviewSummaryResponse;      // 기존 타입 그대로
  reviewKeywords: PerfumeReviewKeywordsResponse;    // 기존 타입 그대로
  reviewStatistics: PerfumeReviewStatisticsResponse;// 기존 타입 그대로
  seasonStatistics: PerfumeSeasonStatisticsResponse;// 기존 타입 그대로
}
```

## 3. 응답 예시

```json
{
  "reviewSummary": {
    "summary": "달콤한 향이 먼저 느껴진다는 의견이 자주 보이고 ...",
    "sourceReviewCount": 16,
    "updatedAt": "2026-09-10T04:22:58.535890Z"
  },
  "reviewKeywords": {
    "keywords": [
      { "keyword": "달콤한", "percentage": 81.8 },
      { "keyword": "포근한", "percentage": 36.4 }
    ]
  },
  "reviewStatistics": { "reviewCount": 16 },
  "seasonStatistics": {
    "seasons": [
      { "seasonId": 1, "code": "SPRING", "name": "봄", "count": 0, "percentage": 0.0 },
      { "seasonId": 2, "code": "SUMMER", "name": "여름", "count": 0, "percentage": 0.0 },
      { "seasonId": 3, "code": "AUTUMN", "name": "가을", "count": 0, "percentage": 0.0 },
      { "seasonId": 4, "code": "WINTER", "name": "겨울", "count": 0, "percentage": 0.0 }
    ]
  }
}
```

## 4. 옮길 때 주의할 것

**빈 값의 모양이 조각마다 다릅니다.** 네 조각을 한 덩어리로 묶었다고 해서 "집계가 없으면
`null`"이 되지 않습니다. 각 조각은 예전과 똑같이 자기 방식으로 비어 있습니다.

| 조각 | 집계가 없을 때 |
| --- | --- |
| `reviewSummary` | 객체는 있고 `summary`·`sourceReviewCount`·`updatedAt`이 모두 `null` |
| `reviewKeywords.keywords` | 빈 배열 (`null` 아님) |
| `reviewStatistics.reviewCount` | `0` |
| `seasonStatistics.seasons` | 계절 **네 칸이 모두** `count: 0`, `percentage: 0.0` |

**로딩 상태가 하나로 합쳐집니다.** 지금은 네 요청이 따로 끝나 조각별로 스켈레톤을 지울 수
있지만, 합치면 네 칸이 동시에 채워집니다. 화면 설계가 조각별 로딩에 기대고 있다면 이 부분만
확인해 주십시오.

**`percentage`의 합이 100을 넘을 수 있습니다.** 기존과 같은 성질입니다. 후기 하나가 키워드
여러 개, 계절 여러 개를 가질 수 있어서입니다. 원형 차트나 누적 막대에 그대로 쓰면 안 됩니다.

## 5. 프론트에서 손댈 곳

읽기만 해서 확인한 현재 호출 지점입니다. 실제 수정은 프론트 담당이 판단합니다.

| 파일 | 지금 | 옮긴 뒤 |
| --- | --- | --- |
| `src/features/perfume/api.ts` | `getPerfumeSeasonStatistics` · `getPerfumeReviewSummary` · `getPerfumeReviewStatistics` · `getPerfumeReviewKeywords` 네 함수 | `getPerfumeReviewAggregates` 하나 |
| `src/features/perfume/queries.ts` | `perfumeSeasonStatisticsQuery` · `perfumeReviewSummaryQuery` · `perfumeReviewStatisticsQuery` · `perfumeReviewKeywordsQuery` | `perfumeReviewAggregatesQuery` 하나 |
| `src/features/perfume/types.ts` | `SeasonStatisticsResponse` · `ReviewSummary` · `ReviewStatistics` · 키워드 타입 | **그대로 둡니다.** 네 타입을 묶는 한 겹만 추가 |
| `src/pages/PerfumeDetailPage.tsx`, `PerfumeReviewSummary.tsx`, `PerfumeReviewKeywords.tsx` | 네 훅을 각각 사용 | 한 훅에서 네 조각을 꺼내 씀 |

**캐시 무효화는 그대로 동작합니다.** 지금 네 키가
`[...perfumeKeys.detail(perfumeId), '<이름>']` 형태이고,
`PerfumeReviewDetail.tsx`의 후기 삭제 후 무효화가
`perfumeKeys.detail(perfumeId)` **접두사**로 걸려 있습니다. 새 키도 같은 접두사 아래
(`[...perfumeKeys.detail(perfumeId), 'review-aggregates']`)에 두면 그 무효화가 그대로 걸립니다.
접두사를 벗어나면 후기를 지워도 통계가 낡은 채 남습니다.

## 6. 왜 합쳤는가

부하 테스트(2026-09-22)에서 이 화면만 다른 API와 다르게 움직였습니다.

| | 이 화면 | 나머지 측정 API 4종 |
| --- | --- | --- |
| 처리량 포화 시점 | **10 VU** | 30 VU |
| 50 VU p95 | **351ms** | 103~115ms |
| VU당 처리량 감소 | 34.3 → 5.0 (**-85%**) | -57~63% |

원인은 화면 한 장이 보내는 요청 수였습니다. 네 요청이 각각 트랜잭션을 열고, 그 안에서 향수
존재 확인(`existsByIdAndActiveTrue`)이 **같은 값으로 네 번** 실행됐습니다.

통합 뒤 실측입니다. 값은 `PerfumeReviewAggregatesIntegrationTest`가 Hibernate 통계로 세며,
숫자를 정확히 못 박아 두어 나중에 되돌아가면 테스트가 깨집니다.

| | 따로 부를 때 | 합쳐 부를 때 |
| --- | --- | --- |
| HTTP 요청 | 4 | **1** |
| 트랜잭션 | 4 | **1** |
| SQL 문 | 10 | **7** |
| 향수 존재 확인 | 4 | **1** |

운영에서 실제로 재 본 결과는 [부하 테스트 결과](review-aggregates-load-test.md)에 있습니다. 요약하면
**CPU 를 21% 덜 쓰면서 화면 처리량이 2.9배**가 됐고, 50 VU 화면 p95 가 324ms 에서 123ms 로
떨어졌습니다.

## 7. 전후 비교 측정 방법

같은 스크립트에 `MERGED` 스위치가 있습니다. VU 단계·지속 시간·think time이 같으므로 두
실행의 `perfume_detail_screen` 표를 그대로 견주면 됩니다.

```powershell
# 기존 방식 (네 번 호출)
k6 run -e MODE=load -e PERFUME_ID=135 -e BASE_URL=https://운영-주소 performance/perfume-detail-aggregates.js

# 통합 방식 (한 번 호출)
k6 run -e MODE=load -e PERFUME_ID=135 -e MERGED=true -e BASE_URL=https://운영-주소 performance/perfume-detail-aggregates.js
```

후기 집계가 실제로 들어 있는 향수를 줘야 합니다. 빈 향수를 주면 집계 비용이 빠진 수치가
나옵니다.

## 8. 기존 네 엔드포인트를 지우는 시점

화면이 통합 엔드포인트만 쓰는 것이 확인된 뒤입니다. 지울 때 함께 지워야 하는 것:

- `PerfumeController`의 네 `@GetMapping`
- `PerfumeService`의 `getReviewSummary` · `getReviewKeywords` · `getReviewStatistics` ·
  `getSeasonStatistics` (안의 `load...`는 통합 쪽이 쓰므로 **남깁니다**)
- `PerfumeReviewAggregatesIntegrationTest`의 동등성 검증 두 건과 쿼리 수 검증 — 견줄 대상이
  없어집니다. 이때 각 조각의 값 검증이 `PerfumeStatisticsIntegrationTest` 등에만 남으므로,
  그 테스트들의 URL을 통합 엔드포인트로 옮겨야 합니다.
