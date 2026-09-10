# 후기 요약 배치 (GMS 연동)

향수에 후기가 쌓이면 GMS 를 통해 LLM 에게 후기를 읽히고, 요약 문장을 데이터베이스에 적재하는
배치입니다. 화면의 AI 후기 요약 구역이 그 문장을 그대로 보여줍니다.

이 문서의 상대 경로는 `backend/`를 기준으로 합니다.

## 1. 무엇을 채우는가

| 테이블 | 채우는 값 | 읽는 API |
| --- | --- | --- |
| `perfume_review_summaries` | 요약 본문, 기준 후기 수, 생성·수정 시각 | `GET /api/v1/perfumes/{id}/review-summary` |

**키워드는 뽑지 않습니다.** 화면의 요약 구역이 문장을 그대로 보여주기로 정해졌습니다. 키워드
통계 구역(`GET .../review-keywords`)은 별개이고, `review_keywords` 와
`perfume_review_keywords` 를 채우는 코드가 없어 빈 배열이 나갑니다. 그 구역을 채우는 일은 따로
남아 있습니다.

**응답의 `summary` 는 문장 하나가 아니라 문장 여러 개가 이어진 한 단락입니다.** 배열로 주지
않고, 화면도 문장별로 쪼개지 않고 한 단락으로 보여주기로 정했습니다. 문장 수(3~4문장)는
지시문이, 길이는 `max-summary-length` 가 지키므로 화면에서 문장을 셀 일이 없습니다. 나중에
문장별로 다르게 그려야 하면, 정규식으로 쪼개지 말고 지시문의 출력 형식을 배열로 바꾸는 쪽이
안전합니다. 한국어 문장 분리는 "2.5시간" 이나 "예:" 같은 데서 깨집니다.

Flyway 마이그레이션은 없습니다. 필요한 표가 `V1` 에 이미 있고, 배치가 읽어야 하는
`perfume_reviews` 의 `title`·`content`·`created_at` 컬럼 매핑만 엔티티에 더했습니다. 스키마는
`V6` 그대로입니다.

## 2. 언제 도는가

스케줄러가 주기적으로 돌면서 아래 두 조건을 모두 만족하는 향수를 집어 듭니다.

1. 후기가 `min-review-count` 개 이상이다.
2. 요약이 없거나, 요약을 만든 뒤로 후기가 `regeneration-step` 개 이상 늘었다.

첫 조건은 요구사항 정의서 DTL-23 의 "일정 개수 이상의 후기가 존재하는 경우 요약을 제공한다"
입니다. 두 번째는 매번 전체 향수를 다시 요약하지 않기 위한 것입니다.

두 번째 조건의 기준값은 요약 행의 `source_review_count` 입니다. 이 값은 **향수에 달린 전체 후기
수**여서 후기 통계 API 의 `reviewCount` 와 기준이 같습니다. 화면도 두 값을 비교해 요약이 최신인지
판단할 수 있고, 배치에게는 "어디까지 처리했는가"의 기록이기도 합니다.

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
| `max-reviews-per-request` | `20` | 한 향수에서 보낼 후기 수(최근 순) |
| `max-review-length` | `1000` | 후기 하나를 보낼 때 자르는 길이 |
| `max-summary-length` | `1000` | 저장할 요약 길이 |
| `gms.base-url` | `https://gms.ssafy.io/gmsapi/api.openai.com/v1` | GMS 경로 |
| `gms.api-key` | (없음) | GMS 키. 환경변수로만 넣습니다 |
| `gms.model` | `gpt-5-nano` | 호출할 모델 |
| `gms.connect-timeout` | `10s` | 연결 제한 시간 |
| `gms.read-timeout` | `120s` | 응답 대기 제한 시간 |

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

요청 본문에는 `model`, `messages`, `response_format` 세 개만 담습니다. 모델 세대에 따라 받지
않는 필드가 있어 최소한만 보냅니다.

- **`temperature` 를 보내지 않습니다.** GPT-5 계열은 이 값을 기본값 외에는 받지 않고 400 으로
  거절합니다. 값 하나가 무시되는 문제가 아니라 호출 자체가 실패합니다. 출력의 흔들림은
  `response_format` 과 지시문으로 잡습니다.
- **지시문의 역할은 `developer` 입니다.** GPT-5 계열이 쓰는 이름이고 `system` 은 그 이전 세대의
  이름입니다.

그래서 `gms.model` 을 다른 세대로 바꿀 때는 이 두 가지가 그 모델에서 유효한지 함께 확인해야
합니다. `GmsReviewAnalyzerTest` 가 두 규칙을 단언으로 잡아 두었습니다.

모델에게 보내는 것은 **후기 번호와 제목·본문뿐**입니다.

- 작성자를 보내지 않습니다. 요약에 필요 없는 개인정보입니다.
- 향수 이름과 브랜드도 보내지 않습니다. 이름을 알려주면 모델이 학습으로 알고 있는 그 향수의
  평판을 요약에 섞습니다. 요구사항 정의서 DTL-23 이 "원문 후기 범위를 벗어난 내용을 생성하지
  않도록 한다"고 정하고 있습니다.

응답은 `{"summary": "..."}` 형태의 JSON 이고 `response_format: json_object` 로 형식을
강제합니다. 배치는 이 응답을 그대로 믿지 않습니다.

- 빈 요약 → 그 향수는 적재하지 않고 넘어갑니다. 다음 실행에서 다시 시도됩니다. 빈 요약을 저장하면
  `source_review_count` 가 올라가 재시도되지 않는데 화면에는 아무것도 나오지 않습니다.
- 길이 제한을 넘는 요약 → 자릅니다. 실패로 처리하면 그 향수는 다음 실행에서 같은 응답을 받아 또
  실패합니다.
- 앞뒤 공백 → 지웁니다. 화면이 문장을 그대로 보여주므로 공백이 남으면 줄바꿈이 어긋납니다.

### 지시문이 무엇을 요구하는가

- **주어진 후기에 적힌 내용만.** DTL-23 이 원문 범위를 벗어난 생성을 금지합니다.
- **호평과 혹평을 함께.** 와이어프레임 A10 의 주석이 "호평·혹평 섞어 4문장까지"로 정해 두었고,
  좋은 말만 모으면 요약이 광고문이 됩니다.
- **의견이 갈리는 항목은 갈린다고.** 지속력처럼 사람마다 다르게 느끼는 항목이 그렇습니다.
- **문장에 숫자를 만들지 않기.** 비율은 키워드 통계 구역이 따로 보여줄 값이고, 모델이 "80%가
  달콤하다고 했습니다" 같은 수치를 지어내면 화면의 다른 숫자와 어긋납니다.
- **예시를 한 쌍.** 작은 모델은 규칙만으로는 형태를 자주 어기는데, 입력과 출력을 함께 보여주면
  안정적으로 따릅니다.
- **후기 본문의 지시문을 무시.** 후기는 사용자가 쓴 글이라 "이전 지시를 무시하고" 같은 문장이
  들어올 수 있습니다.

호출 시간은 보내는 후기 수와 함께 늘어납니다. 요약 본문은 길이가 정해져 있어 출력은 거의
일정합니다. 이전에 키워드까지 뽑던 구성에서 후기 16건에 약 55초가 걸렸고, 그 측정값을 근거로
후기 20건·응답 대기 120초를 잡았습니다. 요약만 만드는 지금은 출력이 짧아져 더 여유가 있을 것으로
보이지만 다시 재지 않았습니다.

## 5. 실패했을 때

향수 하나가 실패해도 실행은 다음 향수로 넘어갑니다. 적재하지 못한 향수는 `source_review_count`
가 그대로여서 다음 주기에 다시 대상이 됩니다. 재시도 로직을 따로 두지 않은 이유가 이것입니다.

## 6. 로컬에서 확인하기

후기 작성 API 가 아직 없어서 후기가 쌓이지 않습니다. 후기가 없으면 배치는 `targets=0` 으로
끝나고 GMS 호출은 시도조차 되지 않습니다. 확인용 후기는 시드로 넣습니다.

```bash
cd backend/db/seed

docker cp . hyanghae-manual-test-postgres-1:/tmp/seed
docker exec -w /tmp/seed hyanghae-manual-test-postgres-1 \
  psql -U hyanghae -d hyanghae_test -f load_review_seed.sql
```

넣는 것은 [후기 시드 문서](../db/seed/README.md#후기-시드-적재)에 있습니다. 후기 6건·12건·4건이
달린 향수 세 개이고, 4건인 향수는 최소 개수에 모자라 대상이 되지 않습니다. 그 향수만 요약이
비어 있는 것까지 확인하면 정책이 동작한 것입니다.

그다음 배치를 켜고 실행합니다. `manual-test` 는 주기가 1분입니다.

```bash
cd backend && REVIEW_ANALYSIS_ENABLED=true GMS_API_KEY=발급받은키 ./gradlew bootRun --args="--spring.profiles.active=manual-test"
```

## 7. 운영에서 확인하기

실행마다 MDC 에 `requestId=batch-<UUID>` 를 넣으므로 한 실행의 로그를 묶어 볼 수 있습니다.
찾을 로그는 다음 두 줄입니다.

```text
Review summary batch completed: targets=3, summarized=2, skipped=1, failed=0, durationMs=8123
Review summary failed: perfumeId=12, exceptionType=java.lang.IllegalStateException
```

후기 원문과 요약 본문은 로그에 남기지 않습니다. GMS 오류 응답의 본문도 예외 메시지에 담지
않습니다(요청을 되돌려주는 API 가 있어 후기 원문이 로그로 새어 나갈 수 있습니다). 그래서 실패
원인은 상태 코드와 예외 종류로 판단합니다.

적재 결과는 SQL 로도 확인할 수 있습니다.

```sql
SELECT perfume_id, source_review_count, length(summary_text) AS summary_length, updated_at
FROM perfume_review_summaries
ORDER BY updated_at DESC
LIMIT 10;
```

## 8. 아직 하지 않은 것

- **키워드 통계 구역.** `review_keywords` 와 `perfume_review_keywords` 를 채우는 코드가
  없습니다. 조회 API 와 `size` 파라미터는 준비돼 있어, 적재하는 쪽만 만들면 화면이 붙습니다.
- **실행 잠금.** 인스턴스가 하나라는 전제로 만들었습니다. 여러 대로 늘리면 같은 향수를 동시에
  요약해 호출이 두 번 나갈 수 있습니다.
- **호출량·토큰 메트릭.** 지금은 실행 로그의 건수로만 비용을 짐작합니다.
- **후기 수정 반영.** 후기 본문이 바뀌어도 후기 수가 변하지 않으면 대상이 되지 않습니다. 후기
  수정 기능이 생기면 함께 정해야 합니다.
- **프론트 타입 반영.** 화면의 `ReviewSummary` 는 아직 `sentences: string[]` 입니다. 한 단락으로
  보여주기로 정했으니 `summary: string | null` 로 바꾸고 조회를 붙이는 일이 남았습니다.
  `frontend/` 는 FE 파트 담당이라 FE 이슈로 넘깁니다.

## 9. 참고 문서

- [백엔드 개발 가이드라인](backend-development-guidelines.md)
- [운영 모니터링 및 Grafana 사용 가이드](operational-logging.md)
- [후기 시드 적재](../db/seed/README.md#후기-시드-적재)
