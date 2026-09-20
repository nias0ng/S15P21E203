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
| `OK_RELAXED` | 조건을 넓혔거나(`RELAXED_OR`) **향 조건이 하나뿐이라 순위를 못 정함**(`SINGLE_BROAD`) | **"조건이 넓습니다"** 를 함께 보여주고 더 자세한 입력을 유도한다. 이유는 `diagnostics.relaxed` 에 있다 |
| `NO_CONDITION` | 향 조건을 하나도 못 뽑음. `perfumes` 는 `[]` | 다시 입력하도록 유도한다 |
| `NO_RESULT` | 조건은 찾았으나 결과가 없음. `perfumes` 는 `[]` | 현재 발생하지 않는다 |

> **`NO_CONDITION` 일 때 인기 향수를 대신 보여주면 안 된다.** 추천처럼 보이지만 근거가
> 없다. *"왜 이게 나왔냐"* 에 답할 수 없고 요구사항 NLR-07(추천 이유 제공)을 어긴다.
>
> ⚠ **2026-09-21 `S15P21E203-351` — 성별·계절·낮밤·노트만 말한 경우는 여기서 빠진다.**
> `중성적인 향수 추천해줘` 는 전에 `NO_CONDITION` 이었는데 이제 `stage=CONTEXT_ONLY` ·
> `status=OK_RELAXED` 로 5건을 낸다. *"중성적인 향수 중에서 평가가 많은 순"* 이라고
> **근거를 댈 수 있어** 위 금지에 안 걸린다. 근거는 `matchedData` 로 온다.
> 조건이 하나도 없으면 여전히 `NO_CONDITION` 이고 `results` 는 `[]` 다.
>
> ⚠ **`CONTEXT_ONLY` 일 때는 화면 문구가 두 가지를 지켜야 합니다.**
>
> ```
> 1  향으로 골랐다고 읽히지 않게 한다        순서는 평가자 수다. 향으로는 못 가렸다
> 2  다 알아들었다고 읽히지 않게 한다        **실측상 100%(합성 20/20)가 못 알아들은
>                                      표현을 갖는다** — 이 경로는 향 표현을
>                                      못 알아들었을 때만 돌기 때문이다
> ```
>
> `귀엽고 여성스러운 디저트 같은 향` 에 `여성적인` 하나로 고른 결과를 *"여성스러운
> 향수를 골랐어요"* 로만 보여주면 **사용자는 디저트·달콤함을 고려했다고 믿는다.**
>
> **`unmatched` 를 화면에 띄우라는 뜻이 아니다** — 위의 *"화면에 쓰지 않는다"* 는
> 그대로다. 못 알아들은 **내용**을 보여주지 않고 못 알아들었다는 **사실**만 밝히면 된다.
> 문구는 프론트가 정한다. 협의 문서는 개인 저장소
> `docs/plans/NLR_CONTEXT_CONDITION_DISCUSSION.md` 에 있다.
>
> 발생 빈도는 **합성 평가셋 600건에서 22.3%, 실사용자 설문 155건에서 48.4%** 다.
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

{ "text": "빨래 냄새 나는 향수 찾고 있어", "structured": null, "topK": 5 }
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `text` | string | 예 | 사용자 원문. **1~500자.** 벗어나면 `400` |
| `structured` | object \| null | 아니오 | ①단계 구조화 결과. 아래 참고 |
| `topK` | number | 아니오 | 기본 5. 1~20 |

`/nlr/understand` 는 `topK` 만 없고 나머지는 같다.

> **`structured` 를 비워도 된다. AI 서버가 스스로 채운다.**
> 비면 AI 서버가 ①단계 LLM 구조화를 직접 부른다. **Spring 은 `text` 만 보내면 된다.**
> 넘기면 그대로 쓰고 LLM 을 부르지 않는다 — Spring 이 스스로 구조화하기로 바뀌어도
> 요청 형식은 안 바뀐다.
>
> 사전 v1.15 기준 합성 600문장에서 조건을 뽑는 비율이 **76.8% → 88.8%** 로 오른다.
> LLM 이 죽어도 사전 매칭으로 내려가므로 **서비스를 내리지 않는다.**

### 요청은 `structured`, 응답은 `conditions` — 다른 것이다

**요청 칸의 이름이 `conditions` 가 아니다.** 응답에도 `conditions` 가 있는데 모양이
달라서, 이름이 같으면 응답의 것을 요청에 되돌려 넣게 된다. 그래서 이름을 나눴다.

| | 무엇 | 안에 든 것 |
|---|---|---|
| **요청**의 `structured` | ①단계 LLM 이 뽑은 **말** | `scent_preference` · `additional_requirements` · … |
| **응답**의 `conditions` | ②단계 사전이 바꾼 **accord** | `core` · `matchedExpressions` · … |

**응답의 `conditions` 를 요청에 넣으면 `400` 이 난다.**

```json
{ "code": "NLR_INVALID_REQUEST",
  "message": "structured 가 ①단계 구조화 결과가 아닙니다 (MISSING_KEY). …" }
```

예전에는 **에러 없이 조건 0개**가 됐고, 원문에 사전 표현이 있으면 우연히 성공하기도
해서 재현이 어려웠다. 지금은 시끄럽게 실패한다.

**다시 넘길 값은 `/nlr/understand` 응답의 `structured` 다.**

```
POST /nlr/understand  { "text": "..." }
   -> { "conditions": {...},     화면에 "이렇게 이해했습니다" 로 쓸 값
        "structured": {...} }    다음 호출에 넘길 값

POST /nlr/recommend   { "text": "...", "structured": <위의 structured 그대로> }
```

이러면 **LLM 을 한 번만 부른다.** 실측 — `structured` 를 넘기면 10ms, `text` 만
보내면 1.40초(LLM 재호출). 그리고 **두 응답의 해석이 같다는 것이 보장된다.**

> **같은 문장을 두 번 부르면 다른 답이 나올 수 있다.** 한 문장을 6번 불렀더니
> 4번은 `lavender`·`powdery` 를, 2번은 **조건 0개**를 냈다. 15문장으로 재현했을 때
> 조건 집합이 같은 것이 9건, 상위 5개가 하나도 안 겹친 것이 5건이었다.
> 그래서 **두 엔드포인트를 한 요청에 각각 부르면 화면의 해석과 결과가 어긋날 수 있다.**

### 응답 (200)

```json
{
  "status": "OK",
  "query": "빨래 냄새 나는 향수 찾고 있어",
  "lexiconVersion": "v1_17",
  "promptSha256": "4f0a368d98b41338",
  "conditions": {
    "core": ["fresh", "soapy"],
    "avoid": [],
    "matchedExpressions": ["빨래"],
    "source": "lexicon_only"
  },
  "matchedData": [
    { "field": "gender", "value": "unisex", "label": "중성적인", "from": null, "tier": "DATA" },
    { "field": "note", "value": "mimosa", "label": "미모사", "from": "미모사", "tier": "DATA" }
  ],
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
  "unmatched": [
    { "expression": "포근한 느낌", "normalizedKey": "포근한 느낌",
      "unmatchReason": "NOT_CORE", "entryId": "kr.sens.cozy",
      "hadConditions": true, "llmAccords": ["amber", "sweet", "vanilla"],
      "tier": "LLM", "resultCount": 1 }
  ],
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
| `matched[].from` | 사용자가 쓴 표현. 이걸 `phrase` 에 쓴다. **사전 항목의 대표 이름이 아니라 실제로 걸린 표면형이다** — `세탁` 이라고 쓰면 `세탁` 이 온다(항목 이름은 `빨래`). 한 항목에 표면형이 여럿 걸리면 **가장 긴 것**이다 — `화이트 머스크` 와 `머스크` 가 함께 걸리면 앞의 것 |
| `matched[].tier` | `VERIFIED`/`TEAM`/`LLM`. **내부 기록이라 사용자에게 노출하지 않는다** |
| `matched[].rationale` | 사람이 쓴 근거 문장. **`tier` 가 `LLM` 이면 `null` 이다** (원칙 ②) |
| `matchedData` | **accord 가 아닌 근거.** 성별·계절·낮밤·노트로 후보를 좁혔을 때 그 조건이 들어온다. `matched` 와 달리 **최상위에 한 번만** 온다 — 추천 5개에 똑같이 적용되기 때문이다. 조건을 안 걸었으면 `[]` |
| `matchedData[].field` | `gender` / `season` / `daypart` / `note` |
| `matchedData[].value` | 데이터 쪽 값. `unisex` · `summer` · `night` · `mimosa`. **사용자에게 노출하지 않는다** |
| `matchedData[].label` | **사용자에게 보여줄 한국어.** `중성적인` · `여름에 어울리는` · `밤에 어울리는`. 노트는 사용자가 쓴 말 그대로다 |
| `matchedData[].from` | 노트만 채운다. 성별·계절·낮밤은 ①단계가 값만 주고 원문의 어느 글자에서 왔는지는 안 줘서 `null` 이다 |
| `matchedData[].tier` | 항상 `DATA`. Fragrantica 사용자 투표에서 직접 온 값이라 `VERIFIED`/`TEAM`/`LLM` 어디에도 안 맞는다 |
| `unmatched` | 사전이 받지 못한 표현. **화면에 쓰지 않는다.** 백엔드가 `nlr_unmatched_expressions` 에 남긴다 — 아래 표 |
| `diagnostics.stage` | `AND` / **`SINGLE_BROAD`** / **`CONTEXT_ONLY`** / `RELAXED_OR` / `RELAXED_OR_NO_THRESHOLD` / `NO_CONDITION` |
| `diagnostics` | 문제를 볼 때 쓴다. 응답에 그대로 넘기지 않는다 |

#### `unmatched[]` 의 칸

| 칸 | DB 칸 | 설명 |
|---|---|---|
| `expression` | `expression` | ①단계가 뽑은 표현 그대로. `무겁지 않게` 처럼 문장 조각 |
| `normalizedKey` | `normalized_key` | 정규화한 키. **집계는 이것으로 한다** |
| `unmatchReason` | `unmatch_reason` | `NOT_IN_LEXICON` / `CONDITION_NOT_MET` / `NOT_CORE`. 셋은 고쳐야 할 곳이 다르다 |
| `entryId` | `entry_id` | 사전에 있는데 조건이 안 맞은 경우만 |
| `hadConditions` | `had_conditions` | 그 요청이 조건을 뽑았는가 |
| `llmAccords` | `llm_accords` | ⑤단계 추정. **`[]` 와 `null` 이 다르다** — 아래 |
| `tier` | `tier` | `"LLM"` 또는 `null`. 사전 경로와 LLM 경로를 가른다 |
| `resultCount` | `result_count` | **AI 가 찾은** 추천 개수. 사용자가 본 개수가 아니다 — 아래. **추정을 물어봤을 때만** 값이 있다 |

**`llmAccords` 의 세 상태를 구분해야 한다.**

```
["woody","green"]   LLM 이 accord 를 골랐다
[]                  **LLM 이 "향이 아니다" 라고 판정했다** — 가격·성별·지속력 같은 것
null                묻지 않았다 (⑤단계가 꺼졌거나 조건이 이미 있었다)
```

`[]` 를 `null` 로 뭉개면 *"향이 아니라고 답한 것"* 과 *"안 물어본 것"* 을 셀 수 없다.

**`resultCount` 는 AI 가 찾은 개수다. 사용자가 본 개수가 아니다.**

둘은 실제로 갈린다. AI 는 자기 데이터 13만 개에서 찾는데 **그 향수가 백엔드 DB 에 없으면
화면에 나가지 않는다.** 그때 백엔드가 `NO_RESULT` 로 내리고 경고를 남긴다.

```
AI 가 5개를 찾았는데 5개 다 DB 에 없는 경우
  화면                      NO_RESULT (0개)
  nlr_recommendation_items  0줄        <- 사용자가 본 개수
  result_count              5          <- AI 가 찾은 개수
```

**AI 기준으로 둔다.** 이 칸이 답하는 질문이 *"⑤단계 추정이 결과를 만들었나"* 이고 그것은
AI 색인 안의 일이다. 백엔드 적재가 밀린 것을 섞으면 **추정이 실제보다 나빠 보인다.**

**사용자가 본 개수를 잃지도 않는다** — `nlr_recommendation_items` 의 줄 수가 그 값이라
두 수가 모두 남는다. **둘이 벌어진 줄은 버그가 아니라 적재가 밀렸다는 신호다.**

**`llmReasoning` 은 보내지 않는다.** LLM 이 매핑한 **뒤에 붙인 설명**이지 근거가 아니다
(`spec.md` 1장). 실측에서 없는 말을 지어냈다 — `"빨레"`(빨래의 오타)를 *"바퀴/롤러로
비유되는 고무·플라스틱 계열"* 로 설명했다. **그 문장이 화면에 나가면 사용자는 근거로
읽는다.** 분석이 필요하면 AI 서버의 파일 로그에 그대로 남아 있다.

#### `conditions.source` 3종 — 지표로 쓸 때 주의하십시오

**"구조화 입력이 있었나" 가 아니라 "조건을 바꿨나" 를 말한다.**

| 값 | 뜻 |
|---|---|
| `lexicon_only` | 구조화 결과가 없었다. 키가 없거나 LLM 호출이 실패했다 |
| `llm+lexicon` | 구조화 결과가 조건을 바꿨다 |
| `llm_no_effect` | 구조화 결과가 있었지만 **원문만으로 잡은 것과 같다** |

합성 600문장에 구조화 결과를 넘겨 재면 이렇게 나온다.

```
llm+lexicon     338건 (56.3%)
llm_no_effect   262건 (43.7%)   그중 조건이 나온 문장 182건
```

> **예전에는 600건 전부 `llm+lexicon` 이었다.** dict 가 넘어오기만 하면 그렇게 적었기
> 때문이다. 이 값으로 "LLM 이 일하고 있다" 를 세면 **43.7% 를 부풀려 세게 된다.**
> `llm_no_effect` 가 늘어난다는 것은 사전이 이미 받아내고 있다는 뜻이기도 하다.

> **`accordKo`(향 특성 한국어 이름)는 아직 없다.** 이 계약서 초안에는 있었는데 구현되지 않았다.
> 그래서 `evidence` 를 무엇으로 채울지가 아직 미정이다 — 아래 「아직 없는 것」 참고.
> **백엔드는 이 칸이 온다고 가정하고 코딩하지 마십시오.**

### `lexiconVersion` · `promptSha256` — 이 기록이 어느 판에서 나왔는지

두 엔드포인트 모두 응답 **최상위**에 싣는다. 화면에는 쓰지 않고 **백엔드가
`nlr_recommendations` 에 그대로 남긴다.**

| 칸 | 예 | DB 칸 | 무엇인가 |
|---|---|---|---|
| `lexiconVersion` | `"v1_17"` | `lexicon_version VARCHAR(20)` | 엔진이 쓴 향 사전 버전 |
| `promptSha256` | `"4f0a368d98b41338"` | `prompt_sha256 VARCHAR(16)` | ①단계 프롬프트 지문 앞 16자 |

**왜 남기나** — 반년 뒤에 *"이 표현이 미매칭이었다"* 를 볼 때 **어느 사전에서 미매칭
이었는지** 모르면 사전을 넓힐 근거가 되지 않는다. 최근에도 사전이 v1.8 → v1.14 →
v1.15, 프롬프트가 v1 → v4 로 움직였다.

**⚠ 둘 다 `null` 일 수 있다.** DB 칸이 둘 다 `NULL` 허용이라 `INSERT` 가 막히지 않는다.

```
lexiconVersion   사전 파일 이름이 `..._v1_17.csv` 규칙에 안 맞을 때 (측정용 임시 파일 등)
promptSha256     프롬프트 파일을 못 읽을 때
```

**`null` 은 "없다" 가 아니라 "모른다" 다.** 추측해서 채우지 마십시오 — 틀린 값이 들어가면
칸이 없는 것보다 나쁘다. 없으면 모른다는 것을 알지만 틀리면 아는 줄 착각한다.

`promptSha256` 은 **①단계 프롬프트만** 가리킨다. ⑤단계 추정 프롬프트는 별개이고 아직
응답에 싣지 않는다.

### `/nlr/understand` 응답 (200)

향수를 찾지 않는다. 향 조건까지만 낸다.

```json
{
  "query": "빨래 냄새 나는 향수 찾고 있어",
  "lexiconVersion": "v1_17",
  "promptSha256": "4f0a368d98b41338",
  "conditions": { "core": ["fresh", "soapy"], "avoid": [],
                  "matchedExpressions": ["빨래"], "source": "llm+lexicon" },
  "structured": { "scent_preference": [], "context": {"season": [], "daypart": [], "gender": []},
                  "performance": {"intensity": "", "longevity": ""}, "avoid": [],
                  "additional_requirements": ["빨래 냄새 나는 향수"] },
  "evidence": [ { "accord": "soapy", "from": "빨래", "tier": "TEAM",
                  "entryId": "kr.scene.laundry", "rationale": "...", "llmReasoning": null } ],
  "unmatched": []
}
```

| 필드 | 설명 |
|---|---|
| `conditions` | ②단계 결과. **화면에 보여줄 해석.** 요청에 되돌려 넣으면 `400` 이다 |
| `structured` | ①단계 결과. **`/nlr/recommend` 의 `structured` 에 그대로 넣는 값.** LLM 이 꺼져 있거나 실패하면 `null` |
| `evidence` | 어느 표현이 어느 accord 로 갔는지와 그 근거. `source` 가 `lexicon_only` 면 사전만 쓴 것 |
| `unmatched` | 위 `/nlr/recommend` 와 같은 모양이다. **다만 이 엔드포인트는 ⑤단계를 돌리지 않아** `llmAccords` · `tier` · `resultCount` 가 전부 `null` 이다 |

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

### 에러 — **전부** 공통 형식이다

```json
{ "code": "NLR_INVALID_REQUEST", "message": "..." }
```

| 상황 | HTTP | `code` |
|---|---|---|
| `text` 가 없거나 1~500자를 벗어남 | `400` | `NLR_INVALID_REQUEST` |
| JSON 문법 오류 | `400` | `NLR_INVALID_REQUEST` |
| **본문이 UTF-8 이 아님** | `400` | `NLR_INVALID_REQUEST` |
| `structured` 가 ①단계 모양이 아님 | `400` | `NLR_INVALID_REQUEST` |
| 없는 경로 | `404` | `NLR_NOT_FOUND` |
| 적재 전 `/health` | `503` | `NLR_NOT_READY` |

> **본문 디코딩 실패만 `{"detail": ...}` 로 나가던 문제를 고쳤다.** FastAPI 가 본문을
> 읽지 못하면 라우트보다 앞 단계에서 `HTTPException` 을 던져 Starlette 기본 형식으로
> 나갔다. 핸들러를 달아 공통 형식으로 맞췄다. 254 MR 리뷰에서 지적된 항목이다.

**`message` 에 요청 값을 싣지 않는다.** 사용자가 쓴 원문이 들어올 수 있고 에러 응답은
그대로 로그에 남는다. 어느 칸이 틀렸는지와 사유만 적는다.

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
| **백엔드** | ~~`POST /api/v1/recommendations/natural-language` 를 만든다~~ · ~~AI 서버 클라이언트~~ · ~~변환 3단계~~ · ~~호출량 제한~~ (S15P21E203-201·320 에서 완료). **`lexiconVersion` · `promptSha256` 과 `unmatched[]` 의 새 네 칸을 받아 `nlr_*` 표에 넣는다** (S15P21E203-325 로 AI 쪽이 보내기 시작했다) |
| **AI** | ~~`POST /nlr/understand` · `/nlr/recommend` 를 만든다~~ (S15P21E203-202 에서 완료). ~~LLM 구조화를 붙인다~~ (완료. `llm_stage1.py`). 미매칭 추정(⑤단계)을 붙인다. 향 특성 92개에 한국어 이름을 단다 |
| **인프라** | AI 서버를 배포에 태운다. 백엔드가 쓸 AI 서버 주소를 환경변수로 넣는다. **AI 서버에도 `GMS_API_KEY` 를 넣는다** — 없으면 서버는 뜨지만 조건을 뽑는 비율이 88.8% → 76.8% 로 떨어진다 |

---

## 바뀌면 알려야 하는 것

이 문서의 필드를 바꾸면 **세 파트가 같이 깨진다.** 바꿀 때는 이 문서를 먼저 고치고 공유한다.

특히 다음은 팀 공통 규약이라 자연어 추천 혼자 바꿀 수 없다.

- 에러 응답 형식 `{ code, message }` — 모든 API 가 쓴다
- `perfumeId` 가 DB 의 `perfume_id` 라는 것 — 상세 페이지·컬렉션이 같은 값을 쓴다
