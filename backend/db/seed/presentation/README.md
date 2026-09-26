# S15P21E203-440 시연 SEED

기본 카탈로그를 유지하면서 활동 데이터를 전부 새로 만드는 **별도 실행 도구**다.
Flyway, 서버 시작, Jenkins 배포에서는 자동 실행하지 않는다. 기존 `run_demo_seed.sh`는
예전 보충 도구이므로 이번 시연에 사용하지 않는다.

## 확정 구성

| 향수 | Fragrantica ID | 후기 | 확인한 운영 URL ID |
| --- | ---: | ---: | ---: |
| Chanel / Coco Mademoiselle | 611 | 20 | 28 |
| Ariana Grande / Cloud (female) | 50384 | 20 | 55 |
| Jo Malone London / Cypress & Grapevine Cologne Intense | 61928 | 15 | 30294 |
| Ostrikov Beauty Publishing / Laundry | 73368 | 8 | 100315 |
| Viktor&Rolf / Flowerbomb | 1460 | 8 | 66605 |
| Rance 1795 / Francois Charles | 3172 | 8 | 144 |
| Ariana Grande / Ari | 31661 | 3 | 27 |
| Ariana Grande / Sweet Like Candy | 39970 | 3 | 26 |

URL 세 개의 이름과 나머지 대상의 검색 결과는 2026-09-27 운영 공개 API로 확인했다. **URL의 DB PK와 외부
Fragrantica ID는 다르다.** 적재는 외부 ID·브랜드·영문 제품명을 모두 확인한 뒤 DB PK를 찾는다.
정확한 제품이 없거나 비활성 상태면 정리 전에 실패한다. 카탈로그를 임의로 만들거나 고치지 않는다.

- 배경 사용자 32명 + 민수·예진 2명 = 34명
- 후기 85개, 계절 선택 85개, 향수 조회 기록 85개
- 배경 컬렉션 3개, 게시글 8개, 댓글 18개
- 진열대 항목 총 39개(배경 사용자 36개 + 예진 3개)
- 진열대는 후기의 OWNED/WISH와 연결하며 SAMPLE/COUNTER 경험에는 자동 보유를 만들지 않는다.
- 좋아요는 소량만 분산하고 자기 글·후기에 좋아요를 넣지 않는다.
- 전체 게시글과 후기는 실제 사용자 글이 아닌 시연용 합성 데이터다.
- 기본 목록이나 자연어 추천의 순위를 고정하기 위한 데이터/코드는 추가하지 않는다.

`reviews.tsv`는 완성된 후기 85개다. 공통 문장 조합을 하지 않는다. `manifest.json`에는
향수 식별값, 닉네임, 컬렉션, 게시글, 작성자 답변을 포함한 댓글 묶음이 있다.
변경 시 데이터 버전도 올리고 테스트 및 내용 검수를 다시 한다.

### 전용 계정

| 계정 | 시작 상태 |
| --- | --- |
| `minsu@demo.hyanghae.test` / 민수 | 진열대·취향 테스트·탐색·후기·컬렉션 없음 |
| `yejin@demo.hyanghae.test` / 예진 | Ari, Sweet Like Candy, Flowerbomb을 보유 중으로 저장 |
| `extra01` ~ `extra32` `@demo.hyanghae.test` | 배경 활동 전용 |

비밀번호는 `SEED_LOGIN_PASSWORD`로 주입한다. 저장소와 로그에 남기지 않는다.
민수의 코코 위시, 예진의 클라우드 저장/후기, 달달한 향 모음/공유 글은 현장에서 만든다.
두 브라우저 프로필로 로그인해 계정 전환 중 서로의 세션을 덮지 않도록 준비한다.

## 실행 모드

| SEED_MODE | 동작 |
| --- | --- |
| 생략 또는 `plan` | 읽기 전용. 정리할 테이블별 현재 건수, 실제 향수 ID, 새 데이터 규모 출력 |
| `replace` | 기존 모든 활동/계정/요약과 이전 local/demo SEED 장부를 비우고 새로 구성 |
| `verify` | 읽기 전용. 배경 후기 수·시연 계정·관계와 날짜 검증. 현장 작성분은 허용 |
| `verify-summaries` | 읽기 전용. 요약 대상 6종의 실제 요약 존재와 기준 후기 수 확인 |
| `reset-actors` | 배경/다른 사용자 보존, 등록된 민수·예진만 삭제 후 초기 상태로 재생성 |

`replace`를 다시 실행하면 다시 전체 정리한다. 증분 보충 명령이 아니다. 중복 행을 누적하지
않으며 새 ID를 발급한다. 카탈로그 ID와 sequence는 건드리지 않고 활동 ID도 재사용하지 않는다.
모든 DB 변경은 한 트랜잭션이다. 삽입/검증 실패 시 기존 활동과 장부 삭제까지 롤백된다.
`TRUNCATE ... RESTRICT`를 사용하고 새 public 테이블이 발견되면 자동 삭제하지 않고 중단한다.

## 보존/정리 범위

보존: `brands`, `notes`, `accords`, `seasons`, `scent_regions`, `post_categories`,
`map_interaction_types`, `perfumes`, `perfume_prices`, `perfume_images`, `perfume_notes`,
`perfume_accords`, `perfume_neighbors`, `perfume_map_points`, `perfume_scent_families`,
`flyway_schema_history`.

정리: 사용자·진열대·메모·컬렉션·글·댓글·좋아요·후기·후기 계절·후기 키워드/사전·요약,
탐색/취향/조회 기록, 자연어 추천 요청/항목/미인식 표현/피드백, 개인화 추천 노출/캐시/오퍼.
정확한 SQL 대상은 `PresentationSeed.ACTIVITY`의 명시적 32개 테이블이다.
`local_seed.records`, `demo_seed.records`는 남은 옛 ID를 복원하지 못하도록 함께 비운다.

S3의 사용자 업로드 객체나 Redis의 인증/캐시는 이 DB 도구가 삭제하지 않는다.
정리 실행 동안 앱/스케줄러의 쓰기를 중지하고, 완료 후 재로그인한다. Redis 데이터가 남더라도
이전 사용자 ID를 재사용하지 않는다. S3 카탈로그 이미지 경로는 절대 삭제하지 않는다.

## 실행 절차

### 1. 준비와 읽기 전용 미리보기

최신 Flyway 적용, 카탈로그 적재, Docker 네트워크를 먼저 확인한다.
접속값은 안전한 환경변수로 주입한다. `.env`나 비밀번호를 MR에 넣지 않는다.

필수 변수: `DEMO_SEED_DOCKER_NETWORK`, `SEED_JDBC_URL`, `SEED_DB_USER`, `SEED_DB_PASSWORD`.

```bash
bash backend/db/seed/run_presentation_seed.sh  # 기본 plan, 데이터 변경 없음
```

로컬 Java 21 환경에서는 `backend/`에서 `./gradlew seedPresentation`도 가능하다.
Windows에서는 `./gradlew.bat seedPresentation`을 사용한다. 환경변수 이름은 동일하다.

### 2. 백업 및 복구 점검

1. 사용자 접근과 백엔드/후기 요약 배치 등 DB writer를 중지한다. 정리/재구성 완료까지 유지한다.
2. **전체 DB 및 모든 스키마**를 `pg_dump -Fc`로 백업한다. 예전 SEED 장부도 복구에 필요하다.
3. `pg_restore --list`가 성공하는지 확인하고, 가능하면 별도 빈 DB로 복구해 카탈로그/계정 건수를 확인한다.
4. 백업 파일을 코드 저장소 밖의 제한된 위치에 보관한다. 파일에는 기존 사용자 정보가 포함된다.

`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`가 대상 DB를 가리키는 환경에서:

```bash
pg_dump --format=custom --file="$SEED_BACKUP_FILE"
pg_restore --list "$SEED_BACKUP_FILE" > /dev/null
```

도구는 백업 파일의 존재·최소 크기·PGDMP 헤더만 검사한다. **백업의 DB 일치나 복구 가능성을
보장하지 않는다.** 해당 검증은 실행 담당자가 위 절차로 수행한다.
실패 후 복구할 때는 서비스를 계속 중지한 채 백업을 별도 빈 DB에 복원·검증하고 연결을 전환한다.
검증 없이 운영 DB에 `--clean`을 실행하지 않는다.

### 3. 전체 재구성

추가 필수 변수: `SEED_EXPECT_DATABASE`(정확한 DB 이름), `SEED_LOGIN_PASSWORD`,
`SEED_BACKUP_FILE`(검증한 custom-format 백업의 호스트 절대 경로).

```bash
SEED_MODE=replace PRESENTATION_SEED_CONFIRM=REPLACE_ALL_ACTIVITY \
  bash backend/db/seed/run_presentation_seed.sh
SEED_MODE=verify bash backend/db/seed/run_presentation_seed.sh
```

백업 파일은 컨테이너에 읽기 전용으로 전달한다. 실패하면 오류 종류/SQLSTATE만 출력하며
DB 행과 비밀번호 해시를 로그로 노출하지 않는다. plan과 확인 후 단일 실행으로 작업한다.

### 4. 실제 AI 요약 준비

SEED에는 요약문을 넣지 않는다. 서비스의 기존 후기 요약 배치를 사용한다.

1. 운영의 `hyanghae.review-analysis.*` 실제 적용값을 확인한다.
2. 유효한 `GMS_API_KEY`와 `REVIEW_ANALYSIS_ENABLED=true`로 서비스를 시작한다.
3. 기본값에서는 매시 10분, 본문 5개부터, 최근 최대 20개를 읽는다. 설정을 바꿨다면 그 값을 따른다.
4. 실행 로그에서 대상 6종의 성공을 확인한다. Ari/Candy는 3개라 기본값에서 요약 대상이 아니다.
5. 다음 명령으로 요약의 존재/기준 후기 수를 확인한다.

```bash
SEED_MODE=verify-summaries bash backend/db/seed/run_presentation_seed.sh
```

이 검사는 문장 품질까지 판정하지 않는다. 코코/클라우드 상세에서 실제 후기를 읽고
요약의 장점·아쉬움·의견 차이에 대응하는 원문이 있는지 확인한다. 창작한 요약문을 직접 넣어
실제 생성 결과처럼 시연하지 않는다. 초기 요약은 각 향수의 모든 후기(최대 20개)를 읽는다.
클라우드는 현장 후기 작성 후 21개가 되지만 요약은 20개 기준으로 남는 것이 기본 동작이다.
기본 재생성 기준은 기존 기준 수에서 10개 증가이며 현장에서 실시간 갱신을 설명하지 않는다.

### 5. 리허설과 계정 초기화

```bash
SEED_MODE=reset-actors PRESENTATION_SEED_CONFIRM=RESET_DEMO_ACTORS \
  bash backend/db/seed/run_presentation_seed.sh
```

이 모드도 서비스 쓰기를 멈추고 수행한다. 민수·예진의 글에 달린 다른 사용자의 댓글도 해당 글과
함께 삭제된다. 배경 계정과 게시글은 보존한다. 초기화 후 새 ID로 재로그인하며, 삭제한 후기의
향수 요약은 오래된 내용을 남기지 않도록 무효화하므로 배치를 다시 돌려 준비한다.

## 발표자가 쓸 문안

- 예진의 클라우드 후기 제목: `포근한 단향이라 가을에 자주 쓸 것 같아요`
- 본문: `오늘 구매한 클라우드를 한 번 뿌려봤어요. 제게는 부드럽고 달콤한 향이 느껴집니다. 실내에서는 이 정도 양이 편했고, 조금 지나니 잔향이 더 마음에 들었어요. 가을에 아리와 번갈아 써보려고 합니다.`
- 계절: 가을
- 새 컬렉션: `달달한 향 모음` — Cloud, Ari, Sweet Like Candy
- 공유 글: `오늘 산 클라우드까지 달달한 향을 모았어요`
- 공유 본문: `아리와 스위트 라이크 캔디에 오늘 구매한 클라우드를 더했습니다. 과일 같은 단향이 당기는 날과 포근한 단향이 당기는 날을 나눠 골라보려고 해요.`

민수 세션으로 이동한 뒤 최신 목록을 갱신해 방금 공유한 글을 확인한다.
자연어 추천의 두 검색어와 우디 취향 테스트/향 지도 경로는 SEED와 별도로 리허설한다.

## 검증

```bash
cd backend
./gradlew test --tests 'com.hyanghae.seed.Presentation*'
./gradlew test
./gradlew assemble localSeedDist
```

통합 테스트는 별도 Testcontainers DB에서 카탈로그 전체 행 보존, 85개 후기/실제 요약 대상 조회,
재실행, 시연 계정 리셋, ID 오인 방지, 미분류 테이블 차단, 삽입 실패 시 전체 롤백을 검증한다.
