# 후기 요약·키워드 배치 (GMS 연동)

향수에 후기가 쌓이면 GMS 를 통해 LLM 에게 후기를 읽히고, 요약과 향 표현 키워드를 데이터베이스에
적재하는 배치입니다. 화면은 이미 있는 조회 API 로 그 값을 읽습니다.

이 문서의 상대 경로는 `backend/`를 기준으로 합니다.

## 1. 무엇을 채우는가

| 테이블 | 채우는 값 | 읽는 API |
| --- | --- | --- |
| `perfume_review_summaries` | 요약 본문, 기준 후기 수, 생성·수정 시각 | `GET /api/v1/perfumes/{id}/review-summary` |
| `review_keywords` | 키워드 어휘(이름에 유니크 제약) | — |
| `perfume_review_keywords` | 후기와 키워드의 연결 | `GET /api/v1/perfumes/{id}/review-keywords` |

키워드는 향수가 아니라 **후기**에 붙습니다(`(review_id, keyword_id)` 기본키). 그래서 한 번의
호출로 요약과 "후기별 키워드"를 함께 받아 옵니다.

## 2. 언제 도는가

스케줄러가 주기적으로 돌면서 아래 두 조건을 모두 만족하는 향수를 집어 듭니다.

1. 후기가 `min-review-count` 개 이상이다.
2. 요약이 없거나, 요약을 만든 뒤로 후기가 `regeneration-step` 개 이상 늘었다.

두 번째 조건의 기준값은 요약 행의 `source_review_count`입니다. 이 값은 **향수에 달린 전체 후기
수**여서 후기 통계 API 의 `reviewCount` 와 기준이 같습니다. 화면도 두 값을 비교해 요약이 최신인지
판단할 수 있습니다.

비활성 향수는 제외합니다. 조회 API 가 비활성 향수에 404 를 주므로 요약을 만들어도 보이지 않고
호출 비용만 나갑니다.

## 3. 설정

기본값은 `ReviewAnalysisProperties` 에 있습니다. yaml 에는 프로필마다 바꿔야 하는 값만 적습니다.

| 키 (`hyanghae.review-analysis.`) | 기본값 | 뜻 |
| --- | --- | --- |
| `enabled` | `false` | 배치 실행 여부 |
| `cron` | `0 10 * * * *` | 실행 주기(매시 10분) |
| `zone` | `Asia/Seoul` | `cron` 해석 시간대 |
| `min-review-count` | `5` | 요약을 만들기 시작하는 최소 후기 수 |
| `regeneration-step` | `10` | 이만큼 후기가 늘면 다시 만듦 |
| `max-perfumes-per-run` | `20` | 한 번 실행의 향수 수 상한 |
| `max-reviews-per-request` | `50` | 한 향수에서 보낼 후기 수(최근 순) |
| `max-review-length` | `1000` | 후기 하나를 보낼 때 자르는 길이 |
| `max-keyword-length` | `50` | 받아들일 키워드 이름 길이(어휘 컬럼과 같음) |
| `max-keywords-per-review` | `5` | 후기 하나에서 받아들일 키워드 수 |
| `max-summary-length` | `1000` | 저장할 요약 길이 |
| `gms.base-url` | `https://gms.ssafy.io/gmsapi/api.openai.com/v1` | GMS 경로 |
| `gms.api-key` | (없음) | GMS 키. 환경변수로만 넣습니다 |
| `gms.model` | `gpt-4o-mini` | 호출할 모델 |
| `gms.connect-timeout` | `10s` | 연결 제한 시간 |
| `gms.read-timeout` | `60s` | 응답 대기 제한 시간 |

`prod` 와 `manual-test` 는 아래 환경변수로 덮어씁니다.

| 환경변수 | 뜻 |
| --- | --- |
| `REVIEW_ANALYSIS_ENABLED` | 배치를 켭니다. 기본은 꺼져 있습니다 |
| `GMS_API_KEY` | GMS 키 |
| `GMS_MODEL` | 모델 이름 |
| `REVIEW_ANALYSIS_CRON` | 실행 주기(`manual-test` 만) |

**배치를 켜면서 `GMS_API_KEY` 를 넣지 않으면 애플리케이션이 시작되지 않습니다.** 주기마다 조용히
401 을 받으며 도는 것보다 배포 시점에 실패하는 편이 낫다고 보고 그렇게 했습니다. 운영에서 켤 때는
배포 디렉터리의 `.env` 에 키를 먼저 넣습니다.

## 4. GMS 연동

GMS 는 상용 LLM API 앞에 놓인 프록시입니다. `base-url` 뒤의 경로와 요청·응답 형식은 원래 API
그대로이고 인증만 GMS 키로 바뀝니다. 지금은 OpenAI 호환 형식(`POST /chat/completions`,
`Authorization: Bearer <키>`)을 씁니다. 다른 업스트림으로 바꾸려면 `base-url` 만 바꾸는 것으로는
안 되고 `GmsReviewAnalyzer` 의 요청·응답 매핑을 함께 고쳐야 합니다.

모델에게 보내는 것은 **후기 번호와 제목·본문뿐**입니다.

- 작성자를 보내지 않습니다. 요약에 필요 없는 개인정보입니다.
- 향수 이름과 브랜드도 보내지 않습니다. 이름을 알려주면 모델이 학습으로 알고 있는 그 향수의
  평판을 요약에 섞습니다. 요구사항 정의서 DTL-23 이 "원문 후기 범위를 벗어난 내용을 생성하지
  않도록 한다"고 정하고 있습니다.

응답은 `{"summary": ..., "reviews": [{"reviewId": ..., "keywords": [...]}]}` 형태의 JSON 이고,
`response_format: json_object` 로 형식을 강제합니다. 배치는 이 응답을 그대로 믿지 않고 다음을
걸러냅니다.

- 보내지 않은 후기 번호 → 버립니다. 다른 향수의 후기에 키워드가 붙는 사고를 막습니다.
- 어휘 컬럼보다 긴 키워드 → 버립니다. 자르면 중간에서 끊긴 이름이 어휘에 남습니다.
- 빈 문자열, 같은 후기의 중복 키워드, 개수 제한 초과 → 정리합니다.
- 빈 요약 → 그 향수는 적재하지 않고 넘어갑니다. 다음 실행에서 다시 시도됩니다.

## 5. 실패했을 때

향수 하나가 실패해도 실행은 다음 향수로 넘어갑니다. 적재하지 못한 향수는 `source_review_count`
가 그대로여서 다음 주기에 다시 대상이 됩니다. 재시도 로직을 따로 두지 않은 이유가 이것입니다.

요약과 키워드는 한 트랜잭션입니다. 요약만 저장되면 `source_review_count` 가 올라가 재생성 대상에서
빠지고 키워드는 영구히 비어 있게 됩니다.

## 6. 운영에서 확인하기

실행마다 MDC 에 `requestId=batch-<UUID>` 를 넣으므로 한 실행의 로그를 묶어 볼 수 있습니다.
찾을 로그는 다음 두 줄입니다.

```text
Review analysis batch completed: targets=3, analyzed=2, skipped=1, failed=0, durationMs=8123
Review analysis failed: perfumeId=12, exceptionType=java.lang.IllegalStateException
```

후기 원문과 요약 본문은 로그에 남기지 않습니다. GMS 오류 응답의 본문도 예외 메시지에 담지
않습니다(요청을 되돌려주는 API 가 있어 후기 원문이 로그로 새어 나갈 수 있습니다). 그래서 실패
원인은 상태 코드와 예외 종류로 판단합니다.

적재 결과는 SQL 로도 확인할 수 있습니다.

```sql
SELECT perfume_id, source_review_count, updated_at
FROM perfume_review_summaries
ORDER BY updated_at DESC
LIMIT 10;
```

## 7. 아직 하지 않은 것

- **실행 잠금.** 인스턴스가 하나라는 전제로 만들었습니다. 여러 대로 늘리면 같은 향수를 동시에
  분석해 호출이 두 번 나갈 수 있습니다.
- **호출량·토큰 메트릭.** 지금은 실행 로그의 건수로만 비용을 짐작합니다.
- **후기 수정 반영.** 후기 본문이 바뀌어도 후기 수가 변하지 않으면 대상이 되지 않습니다. 후기
  수정 기능이 생기면 함께 정해야 합니다.

## 8. 참고 문서

- [백엔드 개발 가이드라인](backend-development-guidelines.md)
- [운영 모니터링 및 Grafana 사용 가이드](operational-logging.md)
