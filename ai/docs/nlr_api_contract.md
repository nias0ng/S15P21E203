# 자연어 추천 API 계약

| | |
|---|---|
| 작성 | 2026-09-14 |
| 상태 | **합의 대기.** 연동 회의에서 확정한다. ② 는 S15P21E203-202 로 구현됨 |
| 대상 | 프론트엔드 · 백엔드 · AI |
| 관련 | `search_rules.md` (검색·정렬 규칙) · `README.md` (실행 방법) |

---

## 이 문서가 정하는 것

경계가 둘이다. 둘의 요청·응답 형식을 정한다.

```
[브라우저] ──①──▶ [Spring] ──②──▶ [AI 서버]
                      │
                      └──▶ [PostgreSQL]   표시 정보 조회
```

| | 경계 | 성격 |
|---|---|---|
| ① | 프론트엔드 ↔ 백엔드 | 공개 API |
| ② | 백엔드 ↔ AI 서버 | 내부 API. 외부에 열지 않는다 |

**이 문서가 확정되면 세 파트가 동시에 작업할 수 있다.** 프론트는 이 형식으로 목 데이터를
만들고, 백엔드는 이 형식으로 응답을 조립하고, AI는 이 형식으로 돌려준다. 서로를 기다리지
않는다.

### 정하지 않는 것

| | 어디를 보나 |
|---|---|
| 검색·정렬 규칙 | `search_rules.md`. **그 파일이 기준이다** |
| 사전 내용 (`빨래 → soapy`) | 별도 분석 작업 |
| 화면 디자인·문구 | 프론트엔드 |

---

## 전제 — 이 계약이 서 있는 결정 넷

이 형식이 왜 이런지 이해하려면 먼저 정해진 것을 알아야 한다.

| | 결정 | 형식에 미치는 영향 |
|---|---|---|
| 1 | **검색은 AI 서버가 한다** | ②의 응답에 향수 목록이 들어간다. Spring 은 SQL 검색을 하지 않는다 |
| 2 | **향수 13만 개를 DB 에 적재한다** | 추천 결과가 **전부** `perfumeId` 를 갖는다. 상세 페이지로 갈 수 있다 |
| 3 | **미니맵을 추천 화면에서 뺀다** | 응답에 좌표(`x`·`y`)가 없다 |
| 4 | **향 지도 200개를 항상 먼저 보여준다** | 형식은 안 바뀐다. 순서만 바뀐다 (`search_rules.md`) |

> **2번이 선행 조건이다.** 13만 적재 전에는 추천 결과의 96.8% 가 DB 에 없어 `perfumeId` 를
> 채울 수 없다. 적재 전까지는 프론트가 목 데이터로 작업한다.

---

## ① 프론트엔드 ↔ 백엔드

### 요청

```
POST /api/v1/recommendations/natural-language
Content-Type: application/json

{ "query": "빨래 냄새 나는 향수 찾고 있어" }
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `query` | string | 예 | 사용자가 쓴 문장. **1~500자.** 초과하면 `400` |

**비회원도 호출할 수 있다.** 로그인 여부가 결과에 영향을 주지 않는다. 차이는 호출량 제한뿐이다.

### 응답 (200)

```json
{
  "status": "OK",
  "query": "빨래 냄새 나는 향수 찾고 있어",
  "perfumes": [
    {
      "perfumeId": 1234,
      "name": "Lazy Sunday Morning",
      "brand": "Maison Martin Margiela",
      "thumbnailUrl": null,
      "reasons": [
        { "phrase": "빨래", "evidence": "비누 같은 · 산뜻한" }
      ]
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `status` | string | 아래 4종. **화면에서 구분해야 한다** |
| `query` | string | 사용자가 쓴 말 그대로 |
| `perfumes` | array | 0~5개. `status` 가 `OK`/`OK_RELAXED` 면 3~5개 |
| `perfumes[].perfumeId` | number | DB 의 `perfume_id`. 상세 페이지 링크에 쓴다 |
| `perfumes[].name` | string | **현재 영어다.** 아래 「아직 없는 것」 참고 |
| `perfumes[].brand` | string | 현재 영어 |
| `perfumes[].thumbnailUrl` | string \| null | **현재 항상 `null`.** 아래 참고 |
| `perfumes[].reasons` | array | 추천 이유. 1~3개 |
| `reasons[].phrase` | string \| null | 사용자가 쓴 표현. 입력어와 무관한 근거면 `null` |
| `reasons[].evidence` | string | 그 표현이 가리키는 향 특성. 한국어. 여럿이면 ` · ` 로 이음 |

### `status` 4종과 화면 처리

| `status` | 뜻 | 화면에서 |
|---|---|---|
| `OK` | 조건을 **전부** 만족하는 향수를 찾음 | 그대로 보여준다 |
| `OK_RELAXED` | 조건을 넓혀서 찾음 | **"조건을 넓혀 찾았습니다"** 를 함께 보여준다 |
| `NO_CONDITION` | 향 조건을 하나도 못 뽑음. `perfumes` 는 `[]` | 다시 입력하도록 유도한다 |
| `NO_RESULT` | 조건은 찾았으나 결과가 없음. `perfumes` 는 `[]` | 현재 발생하지 않는다 |

> **`NO_CONDITION` 일 때 인기 향수를 대신 보여주면 안 된다.** 추천처럼 보이지만 근거가
> 없다. *"왜 이게 나왔냐"* 에 답할 수 없고 요구사항 NLR-07(추천 이유 제공)을 어긴다.
>
> 발생 빈도는 **합성 평가셋 600건에서 22.3%, 실사용자 설문 155건에서 44%** 다.
> 예외가 아니라 정상 경로로 다뤄야 한다.

### 에러

팀 공통 형식을 그대로 쓴다 (`global/response/ApiErrorResponse.java`).

```json
{ "code": "...", "message": "..." }
```

| 상황 | HTTP |
|---|---|
| `query` 가 없거나 500자 초과 | `400` |
| 호출량 제한 초과 | `429` |
| AI 서버 응답 없음 · 타임아웃 | `503` |

**AI 서버가 죽어도 다른 기능은 살아 있어야 한다.** 추천 화면에서만 실패를 알린다.

### 타임아웃

| 구간 | 값 | 근거 |
|---|---|---|
| 브라우저 → 백엔드 | **10초** | `shared/api/http.ts` 에 이미 설정돼 있다 |
| 백엔드 → AI 서버 | **8초 (제안)** | 아래 실측 |

```
LLM 호출 실측 (755회)   중앙값 1.47초 · p90 1.9초 · p99 2.44초 · 최대 3.02초
검색·정렬               4ms
LLM 호출 횟수           1회. 향 조건을 못 뽑으면 추정 호출이 붙어 2회
```

최악의 경우 LLM 2회 + 검색이라 **약 5~6초**다. 8초는 거기에 여유를 둔 값이다.

---

## ② 백엔드 ↔ AI 서버

**엔드포인트가 둘이다.** 안건 1(향수 13만 개 DB 적재)이 어느 쪽으로 가든
`/nlr/understand` 는 그대로 쓴다 — 한국어를 향 조건으로 바꾸는 일은 Python 이 계속 맡는다.

| | 하는 일 |
|---|---|
| `POST /nlr/understand` | 문장 → 향 조건만. 향수를 찾지 않는다 |
| `POST /nlr/recommend` | 문장 → 향수 5개까지 |
| `GET /health` | 적재 완료 여부. Jenkins 헬스체크가 본다 |

### 요청

```
POST /nlr/recommend
Content-Type: application/json

{ "text": "빨래 냄새 나는 향수 찾고 있어", "conditions": null, "topK": 5 }
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `text` | string | 예 | 사용자 원문. **1~500자.** 벗어나면 `400` |
| `conditions` | object \| null | 아니오 | LLM 구조화 결과. 아래 참고 |
| `topK` | number | 아니오 | 기본 5. 1~20 |

`/nlr/understand` 는 `topK` 만 없고 나머지는 같다.

> **`conditions` 는 아직 AI 서버가 스스로 못 채운다.**
> LLM 구조화 호출은 다음 스토리다. 그때까지 이 칸이 비면 사전 문자열 매칭만 쓰고,
> 합성 평가셋 600건 기준 결과가 나오는 비율이 **77.7% → 35.7%** 로 떨어진다.
> 붙고 나면 Spring 은 `text` 만 보내면 된다. **요청 형식은 그때도 안 바뀐다.**

### 응답 (200)

```json
{
  "status": "OK",
  "query": "빨래 냄새 나는 향수 찾고 있어",
  "conditions": {
    "core": ["fresh", "soapy"],
    "avoid": [],
    "matchedExpressions": ["빨래"],
    "source": "lexicon_only"
  },
  "results": [
    {
      "fragranticaId": 73368,
      "name": "Laundry",
      "brand": "Ostrikov Beauty Publishing",
      "people": 29,
      "rating": 4.17,
      "score": 193,
      "matched": [
        { "accord": "soapy", "strength": 100, "from": "빨래", "tier": "TEAM",
          "rationale": "팀 문서의 생활 비유에 '햇빛에 바싹 말린 빨래' 가 있고 …" },
        { "accord": "fresh", "strength": 93, "from": "빨래", "tier": "TEAM",
          "rationale": "같은 축이 '뽀송한' 을 함께 두고 있다. …" }
      ]
    }
  ],
  "unmatched": [],
  "diagnostics": {
    "stage": "AND", "candidateCount": 518, "tieAtLast": 1,
    "relaxed": [], "unmatchedHint": null
  }
}
```

| 필드 | 설명 |
|---|---|
| `results[].fragranticaId` | **Fragrantica 원본 ID.** DB 의 `perfumes.fragrantica_id` 와 같은 값 |
| `results[].people` · `rating` | 평가자 수와 평점. **평점으로 정렬하지 마십시오** — `search_rules.md` 참고 |
| `matched[].accord` | 향 특성 영어 이름. **사용자에게 노출하지 않는다** |
| `matched[].strength` | 0~100. 정렬에 쓴 값 |
| `matched[].from` | 사용자가 쓴 표현. 이걸 `phrase` 에 쓴다 |
| `matched[].tier` | `VERIFIED`/`TEAM`/`LLM`. **내부 기록이라 사용자에게 노출하지 않는다** |
| `matched[].rationale` | 사람이 쓴 근거 문장. **`tier` 가 `LLM` 이면 `null` 이다** (원칙 ②) |
| `unmatched` | 사전이 받지 못한 표현. 백엔드는 안 써도 된다. AI 가 로그에 남긴다 |
| `diagnostics` | 문제를 볼 때 쓴다. 응답에 그대로 넘기지 않는다 |

> **`accordKo`(향 특성 한국어 이름)는 아직 없다.** 이 계약서 초안에는 있었는데 구현되지 않았다.
> 그래서 `evidence` 를 무엇으로 채울지가 아직 미정이다 — 아래 「아직 없는 것」 참고.
> **백엔드는 이 칸이 온다고 가정하고 코딩하지 마십시오.**

### 백엔드가 하는 변환

```
① fragranticaId 로 perfumes 를 조회해 perfume_id · name · brand 를 얻는다
② matched 를 from 별로 묶어 reasons 를 만든다. **evidence 를 무엇으로 채울지는 미정**
③ tier · accord · strength · diagnostics 는 응답에서 뺀다
```

**②의 예**

```
matched  [ {from:"빨래", accord:"soapy"}, {from:"빨래", accord:"fresh"} ]
   ↓
reasons  [ { phrase:"빨래", evidence: ??? } ]
```

`phrase` 는 `from` 을 그대로 쓰면 된다. **`evidence` 가 문제다.** `soapy` 를 사용자에게
보여줄 수 없고, `rationale` 은 "팀 문서의 생활 비유에…" 로 시작하는 내부 근거 문투다.
향 특성 92개에 한국어 표기를 붙이기로 정했으나 **아직 구현되지 않았다.**

---

## 아직 없는 것 — 팀이 알아야 할 제약

이 셋은 **계약의 빈칸이 아니라 데이터가 없는 것**이다. 별도 작업으로 채워야 한다.

| | 현재 상태 | 결과 |
|---|---|---|
| **한글 향수 이름** | `perfumes.name_ko` 가 비어 있다. 시드 SQL 이 *"이 CSV 에 없으므로 건드리지 않습니다"* 라고 적어뒀다 | 향수 이름이 **영어로** 나간다. 200개도 마찬가지다 |
| **썸네일 이미지** | `perfumes` 에 이미지 주소 컬럼이 **없다** | `thumbnailUrl` 이 항상 `null` |
| **추천 이유 문장화** | 미구현 | `evidence` 가 향 특성 이름 나열이다. 문장이 아니다 |

---

## 담당별로 이 계약에서 할 일

| | 무엇을 |
|---|---|
| **프론트엔드** | `features/recommend/api.ts` 의 목 함수를 실제 호출로 바꾼다. `status` 4종 분기를 만든다. 타입에서 `x`·`y` 를 뺀다 |
| **백엔드** | `POST /api/v1/recommendations/natural-language` 를 만든다. AI 서버 클라이언트를 붙인다. 위 「백엔드가 하는 변환」 3단계를 구현한다. 호출량 제한을 건다 |
| **AI** | ~~`POST /nlr/understand` · `/nlr/recommend` 를 만든다~~ (S15P21E203-202 에서 완료). LLM 구조화를 붙인다. 향 특성 92개에 한국어 이름을 단다 |
| **인프라** | AI 서버를 배포에 태운다. 백엔드가 쓸 AI 서버 주소를 환경변수로 넣는다 |

---

## 바뀌면 알려야 하는 것

이 문서의 필드를 바꾸면 **세 파트가 같이 깨진다.** 바꿀 때는 이 문서를 먼저 고치고 공유한다.

특히 다음은 팀 공통 규약이라 자연어 추천 혼자 바꿀 수 없다.

- 에러 응답 형식 `{ code, message }` — 모든 API 가 쓴다
- `perfumeId` 가 DB 의 `perfume_id` 라는 것 — 상세 페이지·컬렉션이 같은 값을 쓴다
