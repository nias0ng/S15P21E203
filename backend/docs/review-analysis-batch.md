# 후기 키워드 추출 배치 (GMS 연동)

향수에 후기가 쌓이면 GMS 를 통해 LLM 에게 후기를 읽히고, 향 표현 키워드를 데이터베이스에
적재하는 배치입니다. 화면은 조회 API 로 상위 키워드와 그 비중을 읽어 요약 문장을 구성합니다.

이 문서의 상대 경로는 `backend/`를 기준으로 합니다.

## 1. 무엇을 채우는가

| 테이블 | 채우는 값 | 읽는 API |
| --- | --- | --- |
| `review_keywords` | 키워드 어휘(이름에 유니크 제약) | — |
| `perfume_review_keywords` | 후기와 키워드의 연결 | `GET /api/v1/perfumes/{id}/review-keywords` |
| `perfume_reviews.keywords_extracted_at` | 그 후기를 처리한 시각 | — |

키워드는 향수가 아니라 **후기**에 붙습니다(`(review_id, keyword_id)` 기본키). 향수 단위로 접어
저장하지 않는 이유는 비중을 계산할 수 없기 때문입니다. "몇 건의 후기에서 이 표현이 나왔는지"가
남아 있어야 백분율이 나오고, 조회 API 가 그 계산을 합니다.

**요약 문장은 만들지 않습니다.** 화면이 상위 키워드 세 개와 그 비중으로 문장을 구성하기로
정해졌습니다. `perfume_review_summaries` 는 아무도 채우지 않고, `GET .../review-summary` 는 빈
응답을 돌려줍니다. 그 표와 엔드포인트를 없앨지는 별도로 정할 일입니다.

## 2. 언제 도는가

스케줄러가 주기적으로 돌면서 아래 두 조건을 모두 만족하는 향수를 집어 듭니다.

1. 후기가 `min-review-count` 개 이상이다.
2. 아직 키워드를 뽑지 않은 후기가 하나 이상 있다.

최소 개수를 두는 이유는 화면 때문입니다. 상위 키워드와 비중을 보여주는데, 후기가 한두 건이면
"후기 100%가 이 표현을 썼다" 같은 값이 나와 오해를 만듭니다. 이 수는 후기 통계 API 의
`reviewCount` 와 같은 기준(향수에 달린 모든 후기)입니다.

재생성 간격은 없습니다. 후기가 한 건만 늘어도 그 한 건은 다음 주기에 처리됩니다. 요약 문장을
만들던 때는 향수 단위로 다시 만들어야 해서 "열 건마다"라는 간격이 필요했지만, 키워드는 후기마다
붙는 값이라 새 후기만 처리하면 됩니다.

**후기 하나는 한 번만 분석합니다.** 어디까지 했는지는 `perfume_reviews.keywords_extracted_at`
이 기록합니다. 키워드 행의 유무로 판단하면 향 표현이 없어 키워드가 0개인 후기를 매 주기 다시
보냅니다. 실측에서 후기 16건 중 5건이 키워드 0개였습니다.

비활성 향수는 제외합니다. 조회 API 가 비활성 향수에 404 를 주므로 키워드를 뽑아도 보이지 않고
호출 비용만 나갑니다. 본문이 비어 있는 후기도 제외합니다. 뽑을 것이 없으면서 토큰만 먹습니다.

## 3. 설정

기본값은 `ReviewAnalysisProperties` 에 있습니다. yaml 에는 프로필마다 바꿔야 하는 값만 적습니다.

| 키 (`hyanghae.review-analysis.`) | 기본값 | 뜻 |
| --- | --- | --- |
| `enabled` | `false` | 배치 실행 여부 |
| `cron` | `0 10 * * * *` | 실행 주기(매시 10분) |
| `zone` | `Asia/Seoul` | `cron` 해석 시간대 |
| `min-review-count` | `5` | 키워드를 뽑기 시작하는 최소 후기 수 |
| `max-perfumes-per-run` | `20` | 한 번 실행의 향수 수 상한 |
| `max-reviews-per-request` | `20` | 한 향수에서 보낼 후기 수(최근 순) |
| `max-review-length` | `1000` | 후기 하나를 보낼 때 자르는 길이 |
| `max-keyword-length` | `50` | 받아들일 키워드 이름 길이(어휘 컬럼과 같음) |
| `max-keywords-per-review` | `5` | 후기 하나에서 받아들일 키워드 수 |
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

한 번의 호출에 걸리는 시간은 **보내는 후기 수에 비례**합니다. 키워드를 후기마다 뽑으므로 출력이
그만큼 길어집니다. `gpt-5-nano` 로 후기 16건에서 키워드를 뽑았을 때 약 55초가 걸렸습니다. 그래서
한 향수에서 보내는 후기를 20건으로 제한하고 응답 대기를 120초로 두었습니다. 이 제한을 올리면
시간 초과가 나고, 그 향수는 매 주기 실패하며 재시도만 반복합니다.

모델에게 보내는 것은 **후기 번호와 제목·본문뿐**입니다.

- 작성자를 보내지 않습니다. 키워드를 뽑는 데 필요 없는 개인정보입니다.
- 향수 이름과 브랜드도 보내지 않습니다. 이름을 알려주면 모델이 학습으로 알고 있는 그 향수의
  평판에서 표현을 끌어옵니다. 후기에 없는 키워드가 통계에 들어가면 안 됩니다.

응답은 `{"reviews": [{"reviewId": ..., "keywords": [...]}]}` 형태의 JSON 이고,
`response_format: json_object` 로 형식을 강제합니다. 배치는 이 응답을 그대로 믿지 않고 다음을
걸러냅니다.

- 보내지 않은 후기 번호 → 버립니다. 다른 향수의 후기에 키워드가 붙는 사고를 막습니다.
- 어휘 컬럼보다 긴 키워드 → 버립니다. 자르면 중간에서 끊긴 이름이 어휘에 남습니다.
- 빈 문자열, 같은 후기의 중복 키워드, 개수 제한 초과 → 정리합니다.

### 지시문이 무엇을 요구하는가

키워드는 화면에서 상위 몇 개를 뽑아 비중과 함께 보여줍니다. 그래서 규칙 대부분이 **집계될 수 있는
표현**을 얻기 위한 것입니다.

- **일반적인 표현을 쓰게 합니다.** 후기 하나에만 나올 기발한 표현은 통계에서 1건으로 남아 순위에
  오르지 못하고 어휘만 늘립니다.
- **입도를 맞춥니다.** "레몬"과 "라임"이 따로 세어지면 개념으로는 두 건인데 순위에서 밀립니다.
  원료 이름보다 향의 계열을 쓰게 하고, 원료가 그 후기의 핵심일 때만 원료 이름을 허용합니다.
- **이미 쓰인 표기를 알려 줍니다.** 후기 하나는 한 번만 분석하므로 이번 호출은 새 후기만 봅니다.
  알려 주지 않으면 같은 표현에 다른 이름이 붙어(`파우더` 와 `파우더리`) 같은 뜻이 두 키워드로
  갈라집니다. 많이 나온 순으로 20개까지 넘깁니다.
- **향이 아닌 평가를 뺍니다.** 세기와 지속 시간("은은한", "오래가는", "잔향"), 배송·가격·용기·계절.
  향 특성 목록에 섞이면 화면이 만드는 문장이 어긋납니다.
- **예시를 한 쌍 붙였습니다.** 작은 모델은 규칙만으로는 형태를 자주 어기는데, 입력과 출력을 함께
  보여주면 안정적으로 따릅니다.

프롬프트나 모델을 바꿔도 이미 처리한 후기는 다시 뽑히지 않습니다. 전체를 다시 뽑아야 하면 이렇게
합니다.

```sql
DELETE FROM perfume_review_keywords;
UPDATE perfume_reviews SET keywords_extracted_at = NULL;
```

## 5. 실패했을 때

향수 하나가 실패해도 실행은 다음 향수로 넘어갑니다. 적재하지 못한 후기는 `keywords_extracted_at`
이 비어 있어 다음 주기에 다시 대상이 됩니다. 재시도 로직을 따로 두지 않은 이유가 이것입니다.

키워드 적재와 추출 시각 기록은 한 트랜잭션입니다. 키워드만 저장되고 시각이 남지 않으면 그 후기를
다음 주기에 다시 보내고, 시각만 남고 키워드가 실패하면 그 후기는 영구히 키워드가 없는 채로 다시
시도되지 않습니다.

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
달린 향수 세 개이고, 4건인 향수는 최소 개수에 모자라 대상이 되지 않습니다. 그 향수만 키워드가
비어 있는 것까지 확인하면 정책이 동작한 것입니다.

그다음 배치를 켜고 실행합니다. `manual-test` 는 주기가 1분입니다.

```bash
cd backend && REVIEW_ANALYSIS_ENABLED=true GMS_API_KEY=발급받은키 ./gradlew bootRun --args="--spring.profiles.active=manual-test"
```

## 7. 운영에서 확인하기

실행마다 MDC 에 `requestId=batch-<UUID>` 를 넣으므로 한 실행의 로그를 묶어 볼 수 있습니다.
찾을 로그는 다음 두 줄입니다.

```text
Review keyword batch completed: targets=3, analyzed=2, skipped=1, failed=0, durationMs=8123
Review keyword extraction failed: perfumeId=12, exceptionType=java.lang.IllegalStateException
```

후기 원문은 로그에 남기지 않습니다. GMS 오류 응답의 본문도 예외 메시지에 담지 않습니다(요청을
되돌려주는 API 가 있어 후기 원문이 로그로 새어 나갈 수 있습니다). 그래서 실패 원인은 상태 코드와
예외 종류로 판단합니다.

적재 결과는 SQL 로도 확인할 수 있습니다.

```sql
SELECT r.perfume_id,
       count(DISTINCT r.id)                        AS reviews,
       count(DISTINCT r.id) FILTER (WHERE r.keywords_extracted_at IS NOT NULL) AS extracted,
       count(rk.keyword_id)                        AS keyword_links
FROM perfume_reviews r
LEFT JOIN perfume_review_keywords rk ON rk.review_id = r.id
GROUP BY r.perfume_id
ORDER BY reviews DESC
LIMIT 10;
```

## 8. 아직 하지 않은 것

- **어휘 통제.** 프롬프트가 "같은 뜻은 같은 표기로" 지시하고 이미 쓰인 이름을 알려 주지만 강제할
  수단은 없습니다. 허용 목록을 정해 목록 밖 이름을 버리면 상위 몇 개의 순위가 안정됩니다.
- **실행 잠금.** 인스턴스가 하나라는 전제로 만들었습니다. 여러 대로 늘리면 같은 향수를 동시에
  분석해 호출이 두 번 나갈 수 있습니다.
- **호출량·토큰 메트릭.** 지금은 실행 로그의 건수로만 비용을 짐작합니다.
- **후기 수정 반영.** 후기 본문이 바뀌어도 `keywords_extracted_at` 이 남아 있어 다시 뽑지
  않습니다. 후기 수정 기능이 생기면 수정 시 이 값을 비우도록 함께 정해야 합니다.
- **쓰이지 않는 요약 표와 엔드포인트.** `perfume_review_summaries` 와
  `GET .../review-summary` 를 없앨지 정해야 합니다.

## 9. 참고 문서

- [백엔드 개발 가이드라인](backend-development-guidelines.md)
- [운영 모니터링 및 Grafana 사용 가이드](operational-logging.md)
- [후기 시드 적재](../db/seed/README.md#후기-시드-적재)
