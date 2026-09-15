# 자연어 향수 추천

사용자가 한국어 문장으로 원하는 향을 쓰면 **향수 5개와 각각의 추천 근거**를 돌려줍니다.

```
"빨래 냄새 나는 향수 찾고 있어"

  1. Laundry             (Ostrikov Beauty Publishing)   soapy=100 · fresh=93
  2. Exit The King       (Etat Libre d'Orange)          soapy=100 · fresh=57
  3. Lazy Sunday Morning (Maison Martin Margiela)       fresh=100 · soapy=50
  ...

  '빨래' -> soapy, fresh 로 해석했고, 각 향수가 어느 조건에 얼마나 맞았는지 함께 돌려줍니다.
```

## 시작하기

**필요한 것** — Python 3.11 이상. 그 외에는 없습니다. DB 도 인터넷도 필요 없습니다.
`pandas` 와 `numpy` 만 설치하면 되고 데이터는 저장소에 들어 있습니다.

### 1. 가상환경 만들기

이 폴더(`ai/`)에서 실행합니다. `venv/` 는 `.gitignore` 에 있어 커밋되지 않습니다.

**Windows (Git Bash)**
```bash
cd ai
python -m venv venv
source venv/Scripts/activate
```

**Windows (PowerShell)**
```powershell
cd ai
python -m venv venv
venv\Scripts\Activate.ps1
```
> `Activate.ps1` 이 막히면 `Set-ExecutionPolicy -Scope Process RemoteSigned` 를 한 번 실행합니다.

**macOS · Linux**
```bash
cd ai
python3 -m venv venv
source venv/bin/activate
```

### 2. 설치

```bash
pip install -r requirements.txt
```

### 3. 한글이 깨지면 — Windows 에서 필요합니다

터미널 인코딩 때문에 출력이 `�Է�   ���� ����` 처럼 깨질 수 있습니다.
**돌리기 전에 한 번 설정하면 됩니다.**

```bash
export PYTHONIOENCODING=utf-8        # Git Bash / macOS / Linux
```
```powershell
$env:PYTHONIOENCODING = "utf-8"      # PowerShell
```

터미널을 새로 열면 다시 설정해야 합니다. 깨지지 않으면 넘어가셔도 됩니다.

### 4. 확인

```bash
python nlr_engine.py "빨래 냄새 나는 향수 찾고 있어"
```

이렇게 나오면 정상입니다.

```
입력   빨래 냄새 나는 향수 찾고 있어
조건   ['fresh', 'soapy']  (표현 ['빨래'])
상태   OK  단계 AND  후보 518
  1. Laundry              Ostrikov Beauty Publ   [soapy=100 fresh=93] 평가자 29
  2. Exit The King        Etat Libre d'Orange    [soapy=100 fresh=57] 평가자 2,358
  ...
```

문장을 여러 개 이어 붙이면 한 번에 돌아갑니다. 데이터는 한 번만 읽습니다.

```bash
python nlr_engine.py \
  "휴양지에서 쓸 향수" \
  "포근한 이불 같은 향" \
  "데이트할 때 쓸 향수"
```

`--json` 을 붙이면 API 가 돌려줄 실제 응답 모양으로 나옵니다.

---

## 코드에서 쓰기

```python
from nlr_engine import load_index, recommend

index = load_index()          # 무겁습니다. 기동 시 한 번만 부르고 재사용하세요
out = recommend(index, "빨래 냄새 나는 향수 찾고 있어")
```

`load_index()` 는 13만 × 92 행렬(약 48MB)을 만듭니다. **요청마다 부르면 안 됩니다.**
적재는 1초 안팎이고, 추천 한 번은 **4ms** 정도입니다.

LLM 구조화 결과가 있으면 세 번째 인자로 넘깁니다.

```python
out = recommend(index, text, conditions)   # 없으면 사전 문자열 매칭만 씁니다
```

---

## 들어 있는 것

```
nlr_engine.py      검색·정렬 엔진. 규칙은 이 파일이 기준입니다
llm_stage1.py      문장 -> 향 조건 구조화. **네트워크를 아는 유일한 파일입니다**
server.py          HTTP 서버 (아래 참고)
unmatched_log.py   사전이 못 받은 표현을 기록합니다 (아래 참고)
build_data.py      원본 덤프에서 data/perfumes_nlr.csv.gz 를 다시 만듭니다
data/
  perfumes_nlr.csv.gz        5.0MB  향수 129,161개 (id·이름·브랜드·accord·평가자수·평점)
  domain_lexicon_v1_8.csv     24KB  한국어 향 표현 53행 -> accord
  accord_dictionary.csv        7KB  accord 92개 마스터 (적재 시 검증용)
  stage1_prompt_v1.txt        2KB   ①단계 구조화 프롬프트 (sha256 앞자리 4f0a368d)
docs/
  search_rules.md            검색 규칙 명세
  nlr_api_contract.md        프론트·백엔드와 주고받을 형식
logs/                        미매칭 로그가 쌓입니다. .gitignore 대상입니다
```

---

## HTTP 서버로 띄우기

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

기동할 때 데이터를 **한 번만** 읽습니다(약 1초). `/health` 가 200 을 주면 준비된 것입니다.

```bash
curl http://localhost:8000/health
# {"status":"ok","perfumes":129161,"accords":92,"llm":true}
```

`"llm"` 이 ①단계 LLM 구조화를 쓸 수 있는 상태인지 알려줍니다. `false` 면 `GMS_API_KEY`
가 없는 것이고, 서버는 정상으로 돌지만 **조건을 뽑는 비율이 86.7% → 75.5% 로 떨어집니다.**
응답만 봐서는 구분이 안 되니 배포 후 이 칸을 확인하십시오. 기동 로그에도 남습니다.

```
INFO:llm_stage1:stage1 프롬프트 적재 stage1_prompt_v1.txt sha256=4f0a368d98b41338
INFO:server:①단계 LLM 구조화 켜짐 (model=gpt-5.4-nano prompt=4f0a368d98b41338)
```

### 한글을 보낼 때 — Windows 에서 주의하십시오

**한글을 명령줄 인자로 직접 넘기면 안 됩니다.** 셸이 인자의 한글을 깨뜨려 서버에
잘못된 바이트가 도착합니다. **서버 문제가 아닙니다.** 두 셸의 증상이 다릅니다.

| 셸 | `-d '{"text":"빨래"}'` 처럼 인자로 넘기면 |
|---|---|
| Git Bash | `400 {"detail":"There was an error parsing the body"}` 로 **터집니다** |
| PowerShell | 에러 없이 **`NO_CONDITION` 이 나옵니다** — 서버가 한글을 못 읽는 것처럼 보입니다 |

PowerShell 쪽이 더 위험합니다. 실패가 조용해서 **기능이 고장난 것으로 오해하기 쉽습니다.**

**Git Bash — 표준입력으로 넘깁니다**

```bash
printf '%s' '{"text":"빨래 냄새 나는 향수 찾고 있어"}' | \
  curl -s -X POST http://localhost:8000/nlr/recommend \
       -H 'Content-Type: application/json' --data-binary @-
```

**PowerShell — UTF-8 바이트로 바꿔서 넘깁니다**

```powershell
$body = @{ text = "빨래 냄새 나는 향수 찾고 있어" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "http://localhost:8000/nlr/recommend" -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

둘 다 `status` 가 `OK`, 조건이 `fresh`·`soapy`, 1위가 `Laundry` 면 정상입니다.
한글이 없는 요청(`/health` 등)은 이 문제가 없습니다.

| 엔드포인트 | 하는 일 |
|---|---|
| `POST /nlr/understand` | 문장 → 향 조건만. **향수를 찾지 않습니다** |
| `POST /nlr/recommend` | 문장 → 향수 5개까지 |
| `GET /health` | 적재 완료 여부. Jenkins 헬스체크가 봅니다 |

**둘로 나눈 이유** — 향수 13만 개를 DB 에 넣을지가 아직 협의 중입니다. 어느 쪽으로 가든
`/nlr/understand` 는 그대로 씁니다. 한국어를 향 조건으로 바꾸는 일은 Python 이 계속 맡습니다.

요청·응답 형식은 [docs/nlr_api_contract.md](docs/nlr_api_contract.md) 에 있습니다.
에러는 백엔드 공통 형식(`{code, message}`)을 씁니다.

### 환경변수

| 이름 | 기본값 | 언제 씁니까 |
|---|---|---|
| **`GMS_API_KEY`** | **없음** | **①단계 LLM 구조화에 필요합니다. 없으면 구조화를 건너뜁니다** |
| `GMS_MODEL` | `gpt-5.4-nano` | 모델을 바꿔 비교할 때 |
| `GMS_ENDPOINT` | SSAFY GMS 게이트웨이 | — |
| `NLR_LOG_PATH` | `ai/logs/unmatched.jsonl` | 컨테이너에서 볼륨 경로를 줄 때 |
| `NLR_LEXICON_PATH` | `data/domain_lexicon_v1_8.csv` | 사전 버전을 바꿔 비교할 때 |
| `NLR_PERFUMES_PATH` | `data/perfumes_nlr.csv.gz` | — |

**키를 코드나 파일에 적지 마십시오.** 환경변수로만 받습니다. 만료되면 HTTP 401 로
`[GMS 에러] Invalid or expired GMS key` 가 오고 **재시도로 풀리지 않습니다** — 포털에서
재발급받아야 합니다. 그동안에도 서버는 사전 매칭으로 계속 돕니다.

### ①단계 LLM 구조화 — 요청에 `structured` 가 없으면 서버가 부릅니다

```
있음 -> 그대로 씁니다. LLM 을 부르지 않습니다
없음 -> llm_stage1.structure() 로 채웁니다. 실패하면 사전 매칭으로 내려갑니다
```

| | 조건을 뽑는 비율 (합성 600문장 · 사전 v1.8) |
|---|---|
| 구조화 + 사전 | **520/600 = 86.7%** |
| 사전만 | 453/600 = 75.5% |

**`/nlr/understand` 를 부른 뒤 `/nlr/recommend` 를 이어 부를 거면 첫 응답의
`structured` 를 두 번째 요청의 `structured` 에 넣으십시오.** 그래야 LLM 을 한 번만
부르고, 두 응답의 해석이 같습니다. 실측 — 넘기면 10ms, 안 넘기면 1.40초.

> **요청 칸은 `structured`, 응답 칸은 `conditions` 입니다.** 응답의 `conditions` 는
> 사전이 바꾼 accord 라 모양이 다릅니다. 요청에 되돌려 넣으면 **`400`** 이 납니다.
> 자세한 것은 계약서의 「요청은 `structured`, 응답은 `conditions`」.

> **같은 문장이라도 다시 부르면 답이 다를 수 있습니다.** 한 문장을 6번 불렀더니 4번은
> `lavender`·`powdery` 를, 2번은 **조건 0개**를 냈습니다.

`conditions.source` 는 **"구조화 결과가 있었나" 가 아니라 "조건을 바꿨나"** 를 말합니다.

| 값 | 뜻 |
|---|---|
| `lexicon_only` | 구조화 결과가 없었습니다. 키가 없거나 호출이 실패했습니다 |
| `llm+lexicon` | 구조화 결과가 조건을 바꿨습니다 — 합성 600문장에서 **338건(56.3%)** |
| `llm_no_effect` | 구조화 결과가 있었지만 원문만으로 잡은 것과 같습니다 — **262건(43.7%)** |

### 아직 서버에 없는 것

- **미매칭 추정(⑤단계).** 사전에 없는 표현을 LLM 이 추측하는 경로입니다. 붙는 자리는
  `nlr_engine.recommend(..., estimator=)` 이고 캐시는 미매칭 로그를 씁니다
- **추천 이유 문장화.** `matched[].rationale` 까지만 만듭니다
- **호출량 제한과 인증.** Spring 이 합니다. 이 서버는 외부에 열지 마십시오
- **Dockerfile.** 배포는 별도 작업입니다

---

## 미매칭 로그 — 사전이 못 받은 말을 남깁니다

지금 사전이 표현을 못 받으면 그 사실이 사라집니다. **합성 평가셋의 22.3%, 실사용자 설문의
44%** 가 향 조건을 하나도 못 뽑는데 그 내용이 안 남습니다. 이걸 남겨 사전을 키우는 근거로 씁니다.

```python
import unmatched_log as ulog

out = recommend(index, "밤에 쓰기 좋은 섹시한 향")
ulog.record(out)                          # 미매칭 표현을 한 줄씩 덧붙입니다

for row in ulog.review_queue(top_n=20):   # 자주 나온 순으로 검토 후보
    print(row["normalized_key"], row["occurrence_count"], row["reasons"])
```

**`conditions` 가 있어야 작동합니다.** 표현을 뽑는 단계가 LLM 구조화이기 때문입니다.
HTTP 서버로 쓰면 `GMS_API_KEY` 만 있으면 서버가 알아서 채우므로 저절로 쌓입니다.
엔진을 직접 부를 때는 `llm_stage1.structure(text)` 결과를 함께 넘기십시오.

미매칭 원인을 셋으로 가릅니다. **고쳐야 할 곳이 다릅니다.**

| 원인 | 뜻 | 무엇을 해야 하나 |
|---|---|---|
| `NOT_IN_LEXICON` | 사전에 없다 | 항목을 추가합니다 |
| `CONDITION_NOT_MET` | 있는데 `match_condition` 이 안 걸렸다 | 조건 토큰을 손봅니다 |
| `NOT_CORE` | 있는데 `optional`/`NO_MAPPING` 이다 | **이미 판정한 이력이 있습니다.** 함부로 올리지 마십시오 |

### LLM 추정을 붙이려면

**이 폴더는 네트워크를 모릅니다.** 추정 함수를 만들어 넘기십시오.

```python
estimate = ulog.cached_estimator(my_gms_call)   # 같은 표현은 한 번만 부릅니다
out = recommend(index, text, conditions, estimator=estimate)
```

조건이 **하나도 안 잡혔을 때만** 부릅니다. 추정으로 나온 조건은 등급이 `LLM` 이고
`rationale` 이 비어 있습니다 — 사전의 근거와 LLM 의 사후 설명을 한 칸에 섞지 않습니다.

### 개인정보

`logs/unmatched.jsonl` 에 **사용자가 입력한 원문이 들어갑니다.** 설문 실측에 건강·신분
서술이 있었습니다. 원문은 500자까지만 저장하고, `logs/` 는 `.gitignore` 에 있습니다.
**한 번 커밋해서 푸시하면 되돌릴 수 없습니다.**

보관 기간이 지난 원문은 이렇게 비웁니다. 표현과 원인은 남고 원문만 사라집니다.

```python
ulog.purge_raw_text()      # 기본 30일
```

### 왜 향수 데이터를 파일로 들고 있나 — 임시 조치입니다

DB 의 `perfumes` 에는 **향 지도용 향수 200개**만 있고 **`people`(평가자 수) 컬럼이 없습니다.**
자연어 추천은 **13만 개 전체**를 뒤지고 평가자 수로 동점을 깨기 때문에 지금 DB 로는 구할 수 없습니다.

| | DB 현재 | 자연어 추천에 필요 |
|---|---:|---:|
| 향수 | 200 | 131,930 |
| accord 종류 | 60 | 92 |
| `perfume_accords` | 1,598행 | 약 80만 행 |
| `people` | 컬럼 없음 | 정렬에 필수 |

**향수 전체가 DB 에 들어가면 이 파일은 필요 없어집니다.** 언제 어떻게 넣을지는 협의 안건입니다.

`data/perfumes_nlr.csv.gz` 는 원본 Fragrantica 덤프(127MB)에서 추천에 쓰는 6개 컬럼만 남기고
accord 가 없는 2,769개를 뺀 것입니다. 원본 SHA-256 앞자리는 `cec1ea0b49885303` 입니다.

```bash
python build_data.py --source /경로/perfumes.csv
```

> `.gz` 는 루트 `.gitattributes` 에서 `binary` 로 지정해야 합니다. 없으면 `text=auto` 가
> 줄바꿈을 변환해 파일이 깨집니다.

---

## 지금 어느 정도 되나 — 실측

합성 평가셋 600건 · **사전 v1.8** 기준, **결과가 나오는 비율**입니다.

| | 비율 | 검색 단계 |
|---|---|---|
| **LLM 구조화 + 사전** | **520/600 = 86.7%** | AND 391 · SINGLE_BROAD 91 · 완화 38 |
| **사전만 (LLM 없이)** | **453/600 = 75.5%** | AND 286 · SINGLE_BROAD 164 · 완화 3 |

조건을 하나라도 뽑으면 **결과가 0개인 경우는 없습니다.**

**LLM 이 없어도 돌아가므로 API 가 죽어도 서비스를 내리지 마십시오.** 다만 사전만 쓰면
`SINGLE_BROAD` 가 91 → 164 로 늘어납니다 — 향 조건이 하나뿐이라 **순위를 향이 아니라
인기도가 정하는 상태**입니다. 비율뿐 아니라 이 분포도 같이 보십시오.

> 이 표는 사전 v1.8 의 값입니다. 이전 판에는 v1.2 기준 `77.7% / 35.7%` 가 적혀 있었습니다.
> 사전만 쓰는 쪽이 35.7% → 75.5% 로 오른 것은 LLM 이 아니라 **사전 확장의 몫**입니다
> (`DECISIONS.md` N10).

---

## 검색 규칙 요약

자세한 내용과 근거는 [docs/search_rules.md](docs/search_rules.md).

```
① 조건 추출   문장에서 사전 표현을 찾아 accord 로
② 검색        그 accord 를 전부 가진 향수 (하드 AND) + 평가자 10명 이상
③ 정렬        strength 합 → 평가자 수 → id,  브랜드당 1개
④ 완화        3개 미만이면 AND→OR, 그래도 부족하면 평가자 문턱 해제
```

**하면 안 되는 것 두 가지**

- **평점(`rating_avg`)으로 정렬하지 마십시오.** 평점 5.00 인 향수 8,410개 중 99.8% 가
  평가자 10명 이하입니다. 평점을 넣으면 평가자 1명짜리가 1위가 됩니다.
- **인기도를 점수에 곱하지 마십시오.** 인기가 향 조건을 이겨서 `soapy` 가 13 밖에 안 되는
  향수가 상위로 올라옵니다.

---

## 응답 형태

```json
{
  "status": "OK",
  "conditions": { "core": ["fresh", "soapy"], "avoid": [],
                  "matched_expressions": ["빨래"], "source": "lexicon_only" },
  "results": [
    { "perfume_id": 73368, "name": "Laundry", "brand": "Ostrikov Beauty Publishing",
      "people": 29, "rating": 4.17, "score": 193,
      "matched": [ { "accord": "soapy", "strength": 100, "from": "빨래",
                     "tier": "TEAM", "rationale": "..." } ] }
  ],
  "diagnostics": { "stage": "AND", "candidate_count": 518, "tie_at_last": 1,
                   "relaxed": [], "unmatched_hint": null }
}
```

`status` 네 가지를 화면에서 구분해 주십시오.

| `status` | 뜻 | 화면에서 |
|---|---|---|
| `OK` | 조건을 다 만족 | 그대로 보여줍니다 |
| `OK_RELAXED` | 조건을 넓혀서 찾음 | **"조건을 넓혀 찾았다"고 알립니다** |
| `NO_CONDITION` | 향 조건을 못 뽑음 (실측 22.3%) | 다시 입력 요청. **인기 향수로 대신하지 마십시오** |
| `NO_RESULT` | 조건은 있는데 결과 없음 | 현재 발생하지 않습니다 |

`matched[].rationale` 이 추천 이유의 재료입니다(요구사항 NLR-07). 문장화는 LLM 이 하되
**이 근거만 주고** 향수의 다른 정보는 주지 마십시오 — 없는 내용을 지어낼 재료를 주지 않는 것이
막는 방법입니다. `tier` 는 내부 기록이라 사용자에게 노출하지 않습니다.

---

## 아직 안 되는 것

| | |
|---|---|
| **API 서버** | 이 스토리 범위 밖입니다. `[AI][Feature] 자연어 추천 API 서버 구현` 에서 붙입니다 |
| **장면 표현 3종** | `데이트`·`섹시한`·`호텔 라운지` 는 사전에 매핑이 없어 결과가 안 나옵니다 |
| **실사용은 더 어렵습니다** | 설문 155건에서 **48.4% 가 조건 0개** 였습니다. 위 22.3% 보다 나쁩니다 |
| **추천 이유 문장화** | 근거까지만 만듭니다. LLM 문장화는 미구현입니다 |
| **한국어 형태소 분석** | 지금은 문자열 포함 매칭이라 표기 변형은 사전의 `aliases` 나열에 의존합니다 |
| **사전 44행이 전부 `candidate`** | 서비스에 써도 되는지 팀 판정이 아직 없습니다 |

설계와 측정 근거는 별도 분석 저장소에 있습니다 — 노트북 40개, 측정 기록 11건, 의사결정 기록 N1~N8.
