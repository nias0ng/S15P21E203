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
build_data.py      원본 덤프에서 data/perfumes_nlr.csv.gz 를 다시 만듭니다
data/
  perfumes_nlr.csv.gz        5.0MB  향수 129,161개 (id·이름·브랜드·accord·평가자수·평점)
  domain_lexicon_v1_2.csv     19KB  한국어 향 표현 44행 -> accord
  accord_dictionary.csv        7KB  accord 92개 마스터 (적재 시 검증용)
docs/
  search_rules.md            검색 규칙 명세
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

합성 평가셋 600건 기준, **결과가 나오는 비율**입니다.

| | 비율 |
|---|---|
| **LLM 구조화 + 사전** | **466/600 = 77.7%** (AND 350 · 완화 116) |
| **사전만 (LLM 없이)** | **214/600 = 35.7%** (AND 167 · 완화 47) |

조건을 하나라도 뽑으면 **결과가 0개인 경우는 없습니다.**

LLM 구조화 결과를 `recommend(index, text, conditions)` 로 넘기면 커버리지가 두 배가 됩니다.
**없어도 돌아가므로 LLM API 가 죽어도 서비스를 내리지 마십시오.**

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
