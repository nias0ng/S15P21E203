"""자연어 향수 추천 엔진.

"한국어 문장 -> 향수 5개 + 추천 근거"를 만든다. HTTP 층은 이 파일에 없다.
**검색·정렬 규칙은 이 파일이 기준이다.** 백엔드가 SQL 로 다시 구현하더라도 여기에 맞춘다.
규칙을 글로 옮긴 것은 `docs/search_rules.md`.

쓰는 법
-------
    from nlr_engine import load_index, recommend

    index = load_index()                       # data/ 의 기본 경로를 쓴다
    out = recommend(index, "빨래 냄새 나는 향수 찾고 있어")

명령줄로도 된다.

    python nlr_engine.py "빨래 냄새 나는 향수 찾고 있어"

①단계 구조화 결과가 있으면 `structured` 로 넘긴다. 없으면 사전 문자열 매칭만 쓴다.
사전 v1.8 기준 합성 600문장에서 조건을 뽑는 비율이 **88.2% -> 75.5%** 로 떨어지지만
서비스는 죽지 않는다.

**입력은 `structured`, 출력은 `conditions` 다.** 이름을 나눈 이유는 모양이 달라서다 —
입력은 LLM 이 뽑은 말(`scent_preference` · `additional_requirements` …)이고
출력은 사전이 바꾼 accord(`core` · `matched_expressions` …)다. 이름이 같던 때에는
출력을 입력에 되돌려 넣어 **조용히 조건 0개**가 되는 일이 있었다.

의존성: pandas, numpy. 그 외 표준 라이브러리만.
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

LOGGER = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 규칙 파라미터 — search_rules.md 의 [측정] / [제안] 과 1:1 대응한다
# ---------------------------------------------------------------------------
TOP_K = 5                 # [제안] 요구사항 NLR-01 의 "3~5개"
MIN_RESULTS = 3           # [측정] 이 아래로 내려가면 완화 사다리를 탄다
PEOPLE_MIN = 10           # [측정] 평가자 문턱. 커버리지 손실 0.3%p
BRAND_CAP = 1             # [제안] 브랜드당 최대 개수
MIN_CORE_FOR_AND = 2      # AND 를 쓸 최소 조건 수. 하나뿐이면 SINGLE_BROAD 로 간다

# ①단계 구조화 결과에서 이 엔진이 실제로 읽는 칸. 나머지(context·performance)는 안 읽는다 —
# 계절 데이터가 0건이라 아직 검색에 못 쓴다(spec 6장 제약 1).
STRUCTURED_KEYS = ("scent_preference", "avoid", "additional_requirements")

# 기본 데이터 경로. 인자로 덮어쓸 수 있다.
_DATA_DIR = Path(__file__).resolve().parent / "data"
DEFAULT_PERFUMES = _DATA_DIR / "perfumes_nlr.csv.gz"
DEFAULT_LEXICON = _DATA_DIR / "domain_lexicon_v1_8.csv"
DEFAULT_ACCORDS = _DATA_DIR / "accord_dictionary.csv"
DEFAULT_NOTE_BRIDGE = _DATA_DIR / "note_accord_bridge.csv"

# [측정] 노트 브리지 문턱. 측정 기록 18·19번.
#
# ①단계가 `scent_preference` 에 accord 이름이 아니라 **노트(원료) 이름** 을 넣는 일이
# 잦다 — 합성 600 에서 256회(31.8%). `_normalize_accord` 는 그것을 통째로 버린다.
# 그중 111회(43.4%)가 이 표로 풀린다.
#
#   p    그 노트를 가진 향수 중 이 accord 를 가진 비율
#   lift p 를 그 accord 의 기저율로 나눈 값. **1 이면 정보가 없다**
#
# `p` 만 쓰면 기저율이 조건으로 섞인다 — `woody` 는 전체 향수의 61.7% 가 가지고 있어
# 어떤 노트든 `p >= 0.5` 를 넘긴다. `peony -> woody` 는 p 0.536 인데 lift 0.87 로
# **작약이 있으면 오히려 덜 나온다.** 그래서 lift 를 함께 건다.
#
# 1.4 는 DECISIONS.md N4 의 통제군이 정한 값이다(무작위 집단에서 1.17·1.38·1.14).
# 72번 스윕에서 **0~1.6 구간은 NDCG 가 서로 갈리지 않고 1.7 부터 확실히 나빠진다.**
# 그 평지 안에서 유일하게 근거가 있는 값이라 1.4 를 골랐다.
BRIDGE_P_MIN = 0.5
BRIDGE_LIFT_MIN = 1.4

# [측정] 한글 accord 표기 10종. 11_rule_lexicon.csv 가 인정한 외래어 음차다.
# 합성 평가셋 600건에서 80건이 여기 걸린다(대부분 '바닐라').
KOREAN_ACCORD = {
    "바닐라": "vanilla", "스위트": "sweet", "시트러스": "citrus",
    "아로마틱": "aromatic", "앰버": "amber", "우디": "woody",
    "파우더리": "powdery", "프레시": "fresh", "프루티": "fruity", "플로럴": "floral",
    "우디한": "woody", "파우더리한": "powdery", "프레시한": "fresh",
    "플로럴한": "floral", "프루티한": "fruity", "스위트한": "sweet",
}


# ---------------------------------------------------------------------------
# 적재
# ---------------------------------------------------------------------------
def load_index(perfumes_csv=None, lexicon_csv=None, accord_csv=None, verify=True,
               bridge_csv=None, bridge_p_min=BRIDGE_P_MIN,
               bridge_lift_min=BRIDGE_LIFT_MIN):
    """향수 데이터와 사전을 읽어 조회용 인덱스를 만든다.

    perfumes_csv : str | Path | None   기본 data/perfumes_nlr.csv.gz
    lexicon_csv  : str | Path | None   기본 data/domain_lexicon_v1_8.csv
    accord_csv   : str | Path | None   기본 data/accord_dictionary.csv (accord 92개 마스터)
    verify       : bool                accord 보유 수를 마스터와 대조해 틀리면 RuntimeError
    bridge_csv   : str | Path | None   기본 data/note_accord_bridge.csv (노트→accord)
                                       **없어도 엔진은 돈다.** 경고를 남기고 노트를 해석하지
                                       않는다 — 코드만 먼저 배포한 경우를 막지 않는다
    bridge_p_min : float               기본 BRIDGE_P_MIN
    bridge_lift_min : float            기본 BRIDGE_LIFT_MIN

    무겁다. 13만 x 92 행렬을 만드므로 **기동 시 한 번만 부르고 재사용한다.**

    반환: dict — recommend() 에 그대로 넘긴다.
    """
    perfumes_csv = Path(perfumes_csv) if perfumes_csv else DEFAULT_PERFUMES
    lexicon_csv = Path(lexicon_csv) if lexicon_csv else DEFAULT_LEXICON
    accord_csv = Path(accord_csv) if accord_csv else DEFAULT_ACCORDS

    perf = pd.read_csv(
        perfumes_csv,
        usecols=["id", "name", "brand", "accords", "people", "rating_avg"],
        low_memory=False,
    )
    lex = pd.read_csv(lexicon_csv, keep_default_na=False, dtype=str)
    accord_master = pd.read_csv(accord_csv)

    accords = sorted(accord_master["accord"].astype(str))
    aidx = {a: i for i, a in enumerate(accords)}

    pairs = perf["accords"].map(_parse_accords)
    if verify:
        counts = {}
        for ps in pairs:
            for name, _ in ps:
                counts[name] = counts.get(name, 0) + 1
        bad = [r["accord"] for r in accord_master.to_dict("records")
               if counts.get(r["accord"], 0) != r["perfume_count"]]
        if bad:
            raise RuntimeError(f"accord 보유 수가 마스터와 다르다: {bad[:5]}")

    strength = np.zeros((len(perf), len(accords)), dtype=np.float32)
    for row, ps in enumerate(pairs):
        for name, value in ps:
            col = aidx.get(name)
            if col is not None:
                strength[row, col] = value

    lex_rows = lex[(lex["candidate_type"] == "ACCORD")
                   & (lex["target_field"] != "NO_MAPPING")].to_dict("records")
    by_expression = {}
    for row in lex_rows:
        by_expression.setdefault(row["expression"], []).append(row)

    surface = {}
    entry_ids = {}
    for row in lex.to_dict("records"):
        entry_ids.setdefault(row["expression"], row["entry_id"])
        variants = [row["expression"]] + [a for a in row["aliases"].split("|") if a]
        for form in variants:
            if form:
                surface.setdefault(form, set()).add(row["expression"])

    note_bridge = _load_note_bridge(
        Path(bridge_csv) if bridge_csv else DEFAULT_NOTE_BRIDGE,
        aidx, bridge_p_min, bridge_lift_min)

    return {
        "accords": accords,
        "aidx": aidx,
        "note_bridge": note_bridge,
        "strength": strength,
        "has": strength > 0,
        "pid": perf["id"].to_numpy(),
        "name": perf["name"].astype(str).to_numpy(),
        "brand": perf["brand"].astype(str).to_numpy(),
        "people": perf["people"].fillna(0).to_numpy(),
        "rating": perf["rating_avg"].fillna(0).to_numpy(),
        "lexicon_by_expression": by_expression,
        "lexicon_surface": surface,
        "lexicon_entry_id": entry_ids,
        "n_perfumes": len(perf),
    }


def _load_note_bridge(path, aidx, p_min, lift_min):
    """노트 이름 -> accord 표를 읽어 조회용 dict 로 만든다. dict[str, list[str]].

    path    : Path   note · accord · p · lift 네 칸을 가진 CSV
    aidx    : dict   accord 이름 -> 열 번호. 여기 없는 accord 는 버린다
    p_min   : float  `p` 문턱
    lift_min: float  `lift` 문턱

    키는 **소문자로 정규화한 노트 이름**이다. ①단계 LLM 이 `Mint` · `mint` 를 섞어 쓴다.
    값은 그 노트가 부르는 accord 목록이고, 노트 하나당 평균 2.56개다.

    **파일이 없으면 빈 dict 를 주고 경고만 남긴다.** 이 표는 조건을 넓히는 보강재이지
    엔진이 도는 데 필요한 것이 아니다. 없으면 이 기능을 얹기 전과 똑같이 동작한다.

    깨질 수 있는 곳 — `p` · `lift` 칸이 숫자가 아니면 비교가 조용히 거짓이 되어 행이
    사라진다. 그래서 읽은 뒤 몇 행이 남았는지 로그에 남긴다.
    """
    if not Path(path).exists():
        LOGGER.warning(
            "노트 브리지 파일이 없다: %s. 노트 이름(`mint` 등)은 해석하지 않는다. "
            "엔진은 정상 동작하지만 조건 추출이 이 기능을 얹기 전 수준으로 돌아간다", path)
        return {}

    table = pd.read_csv(path)
    missing = [c for c in ("note", "accord", "p", "lift") if c not in table.columns]
    if missing:
        raise RuntimeError(f"노트 브리지에 필요한 칸이 없다: {missing} ({path})")

    total = len(table)
    table = table.dropna(subset=["note", "accord"])
    empty = total - len(table)
    if empty:
        LOGGER.warning("노트 브리지에서 note·accord 가 비어 있는 %d행을 버렸다 (%s)",
                       empty, path)

    table = table[table["accord"].isin(aidx)]
    table = table[(pd.to_numeric(table["p"], errors="coerce") >= p_min)
                  & (pd.to_numeric(table["lift"], errors="coerce") >= lift_min)]

    bridge = {}
    for note, accord in zip(table["note"], table["accord"]):
        key = re.sub(r"\s+", " ", str(note).strip().lower())
        # 공백뿐인 노트는 `""` 가 되어 걸러진다. `"nan"` 은 pandas 가 결측을 글자로
        # 남겼을 때 나오는데 `dropna` 를 통과하므로 여기서 한 번 더 막는다
        # (`_parse_accords` 도 같은 방식으로 막는다).
        if not key or key == "nan":
            continue
        bridge.setdefault(key, [])
        if accord not in bridge[key]:
            bridge[key].append(accord)
    LOGGER.info("노트 브리지 %d행 중 p>=%.2f · lift>=%.2f 를 통과한 %d행 "
                "-> 노트 %d개", total, p_min, lift_min, len(table), len(bridge))
    # 값을 tuple 로 굳힌다. `_bridge_lookup` 이 이 객체를 그대로 돌려주므로 list 면
    # 부른 쪽이 고쳤을 때 표가 망가진다.
    return {k: tuple(v) for k, v in bridge.items()}


def _parse_accords(value):
    """'name:strength|name:strength' 한 칸을 파싱한다. list[tuple[str, float]]."""
    out = []
    for part in str(value).split("|"):
        if not part or part == "nan":
            continue
        name, _, raw = part.partition(":")
        try:
            out.append((name, float(raw)))
        except ValueError:
            continue
    return out


# ---------------------------------------------------------------------------
# 1단계 — 문장에서 조건 뽑기
# ---------------------------------------------------------------------------
def understand(index, text, structured=None):
    """문장에서 core accord 와 회피 accord 를 뽑는다.

    index      : dict          load_index() 결과
    text       : str           사용자 원문
    structured : dict | None   ①단계 구조화 결과. spec 3장 2-a 형식.
                               None 이면 사전 문자열 매칭만 쓴다.

    반환: dict — core / avoid / matched_expressions / evidence / source / unmatched

    **반환의 `conditions` 계열 값을 이 함수의 `structured` 로 되돌려 넣지 않는다.**
    모양이 다르다. 넣으면 읽히는 칸이 없어 조건이 0개가 된다. 그래서 이름을 나눴고,
    셋 중 빠진 칸이 있으면 경고를 남긴다.

    `unmatched` 는 LLM 이 뽑았으나 사전이 받지 못한 표현이다. `structured` 가 없으면
    표현을 뽑는 단계 자체가 없으므로 항상 빈 목록이다 — **미매칭 로그는 ①단계 구조화가
    있어야 작동한다.**
    """
    text = unicodedata.normalize("NFC", str(text))
    parts = [text]
    if structured:
        missing = [key for key in STRUCTURED_KEYS if key not in structured]
        if missing:
            LOGGER.warning(
                "structured 에 엔진이 읽는 칸이 없다: %s. ①단계 구조화 결과를 넘겨야 한다 "
                "— 응답의 conditions(②단계 결과)를 되돌려 넣으면 조건이 0개가 된다", missing)
        parts += [str(v) for v in (structured.get("additional_requirements") or [])]
    haystack = " ".join(parts)

    core, evidence = _extract(index, haystack)

    if structured:
        for raw in (structured.get("scent_preference") or []):
            accord = _normalize_accord(index, raw)
            if accord:
                core.add(accord)
                evidence.append({"from": str(raw), "accord": accord,
                                 "tier": "VERIFIED", "rationale": "accord 이름 직접 일치"})
                continue
            # accord 이름이 아니면 노트(원료) 이름일 수 있다. 전에는 여기서 버렸다.
            #
            # **근거(evidence)를 남기지 않는다.** 계약 문서가 `tier` 를
            # VERIFIED/TEAM/LLM 세 값으로 적어 뒀고, 이 경로는 셋 중 어디에도 맞지
            # 않는다(코퍼스에서 잰 동시출현이다). 새 값을 만드는 것은 계약 변경이라
            # 팀이 정할 일이다. 근거가 없으면 `matched[]` 의 from·tier·rationale 이
            # null 로 나간다 — recommend() 가 이미 그렇게 처리한다.
            core.update(_bridge_lookup(index, raw))

    avoid = set()
    for raw in ((structured or {}).get("avoid") or []):
        accord = _normalize_accord(index, raw)
        if accord:
            avoid.add(accord)

    return {
        "core": sorted(core - avoid),
        "avoid": sorted(avoid),
        "matched_expressions": sorted({e["from"] for e in evidence}),
        "evidence": evidence,
        "source": _source(index, text, structured, core - avoid),
        "unmatched": _unmatched(index, structured, haystack, evidence),
    }


def _extract(index, haystack):
    """건초더미에서 core accord 와 근거를 뽑는다. (set, list).

    사전 표현과 한글 accord 표기 둘 다 본다. `understand()` 가 두 번 부른다 —
    한 번은 원문+구조화, 한 번은 원문만. 둘을 비교해 `source` 를 정한다.
    """
    core, evidence = _lexicon_lookup(index, haystack)
    for korean, accord in KOREAN_ACCORD.items():
        if korean in haystack and accord in index["aidx"]:
            core.add(accord)
            evidence.append({"from": korean, "accord": accord,
                             "tier": "TEAM", "rationale": "한글 accord 표기"})
    return core, evidence


def _source(index, text, structured, final_core):
    """조건을 무엇이 만들었는지. str.

    lexicon_only   구조화 결과가 없었다
    llm+lexicon    구조화 결과가 조건을 바꿨다
    llm_no_effect  구조화 결과가 있었지만 원문만으로 잡은 것과 결과가 같다

    **"구조화 결과가 있었나" 가 아니라 "조건을 바꿨나" 로 센다.** 예전에는 dict 가
    넘어오기만 하면 `llm+lexicon` 이라, 조건이 0개가 된 경우에도 LLM 이 기여했다고
    말했다. 이 값으로 지표를 만들면 잘 도는 것처럼 보인다 — 254 MR 리뷰 지적이다.
    """
    if not structured:
        return "lexicon_only"
    text_only, _ = _extract(index, text)
    return "llm+lexicon" if final_core != text_only else "llm_no_effect"


def _unmatched(index, structured, haystack, evidence):
    """LLM 이 뽑았으나 사전이 받지 못한 표현. list[dict].

    조건이 잡힌 요청에서도 남은 표현을 전부 기록한다. 실측상 조건이 잡힌 쿼리 속에
    숨은 미매칭이 합성 600건에서 1,339회 있었고, 조건 0건만 보면 그게 안 보인다.
    """
    if not structured:
        return []
    matched = {e["from"] for e in evidence if e.get("from")}
    out = []
    for raw in (structured.get("additional_requirements") or []):
        expression = unicodedata.normalize("NFC", str(raw)).strip()
        if not expression:
            continue
        if any(form in expression for form in matched):
            continue          # 이 표현 안에서 사전이 무언가를 잡았다
        reason, entry_id = _classify_unmatch(index, expression, haystack)
        out.append({
            "expression": expression,
            "normalized_key": re.sub(r"\s+", " ", expression).lower(),
            "unmatch_reason": reason,
            "entry_id": entry_id,
        })
    return out


def _classify_unmatch(index, expression, haystack):
    """미매칭 원인을 셋으로 가른다. (str, str | None).

    셋은 고쳐야 할 곳이 다르다. 한 칸으로 뭉개면 **이미 내린 결정을 다시 제안하게 된다** —
    `포근한` 은 DECISIONS.md N5 가 측정으로 `optional` 로 강등한 표현이라 영영 안 걸린다.

    NOT_IN_LEXICON     사전에 없다              -> 항목을 추가한다
    CONDITION_NOT_MET  match_condition 이 탈락  -> 조건 토큰을 손본다
    NOT_CORE           optional / NO_MAPPING    -> 판정 이력이 있다. 함부로 올리지 않는다
    """
    hit = set()
    for form, expressions in index["lexicon_surface"].items():
        if form and form in expression:
            hit |= expressions
    if not hit:
        return "NOT_IN_LEXICON", None

    entry_id, condition_failed = None, False
    for name in sorted(hit):
        entry_id = entry_id or index["lexicon_entry_id"].get(name)
        for row in index["lexicon_by_expression"].get(name, []):
            condition = row["match_condition"]
            if condition.startswith("query_contains:"):
                tokens = [t for t in condition.split(":", 1)[1].split(",") if t]
                if not any(t in haystack for t in tokens):
                    condition_failed = True
    return ("CONDITION_NOT_MET" if condition_failed else "NOT_CORE"), entry_id


def _lexicon_lookup(index, haystack):
    """사전에서 표현을 찾아 core accord 와 근거를 낸다. (set, list)."""
    hit = set()
    for form, expressions in index["lexicon_surface"].items():
        if form and form in haystack:
            hit |= expressions

    core, evidence = set(), []
    for expression in sorted(hit):
        for row in index["lexicon_by_expression"].get(expression, []):
            condition = row["match_condition"]
            if condition.startswith("query_contains:"):
                tokens = [t for t in condition.split(":", 1)[1].split(",") if t]
                if not any(t in haystack for t in tokens):
                    continue
            if row["required"] != "core":
                continue
            accord = row["candidate_name"]
            if accord not in index["aidx"]:
                continue
            core.add(accord)
            evidence.append({
                "from": expression,
                "accord": accord,
                "tier": row["evidence_tier"],
                "entry_id": row["entry_id"],
                "rationale": row["rationale"],
            })
    return core, evidence


def _normalize_accord(index, raw):
    """영어 향 이름 하나를 accord 로 해석한다. str 또는 None."""
    value = str(raw)
    if value in index["aidx"]:
        return value
    lowered = re.sub(r"\s+", " ", value.strip().lower())
    if lowered in index["aidx"]:
        return lowered
    singular = re.sub(r"s\b", "", lowered).strip()
    if singular in index["aidx"]:
        return singular
    for guess in (re.sub(r"e$", "", singular) + "y", singular + "y"):
        if guess in index["aidx"]:
            return guess
    return None


def _bridge_lookup(index, raw):
    """노트(원료) 이름 하나가 부르는 accord 목록. tuple[str, ...].

    `_normalize_accord` 가 못 푼 값에만 쓴다. 표에 없으면 빈 tuple 이다.
    표를 못 읽었으면(파일 없음) 항상 빈 tuple 이라 이전과 같이 동작한다.

        "Mint"   -> ("aromatic", "fresh spicy", "green")
        "lemon"  -> ("aromatic", "citrus")
        "flower" -> ()          표에 없다. 노트가 아니라 형용사다

    **표의 값을 그대로 돌려준다. 복사하지 않는다.** 그래서 `_load_note_bridge` 가
    tuple 로 굳혀 둔다 — list 면 부른 쪽이 고쳤을 때 표가 망가진다.

    `index` 에 `note_bridge` 키가 없어도 동작한다. 이 기능을 얹기 전 `load_index()` 가
    만든 인덱스가 들어올 수 있다 — 그때는 이전과 똑같이 노트를 해석하지 않는다.
    """
    bridge = index.get("note_bridge")
    if not bridge:
        return ()
    return bridge.get(re.sub(r"\s+", " ", str(raw).strip().lower()), ())


# ---------------------------------------------------------------------------
# 2단계 — 검색 · 정렬 · 완화
# ---------------------------------------------------------------------------
def search(index, core, avoid=(), top_k=TOP_K, people_min=PEOPLE_MIN,
           brand_cap=BRAND_CAP, min_results=MIN_RESULTS):
    """조건으로 향수를 찾아 정렬한다.

    반환: dict — rows(행 인덱스) / stage / candidate_count / tie_at_last / relaxed
    """
    cols = [index["aidx"][a] for a in core if a in index["aidx"]]
    if not cols:
        return {"rows": [], "stage": "NO_CONDITION", "candidate_count": 0,
                "tie_at_last": 0, "relaxed": []}

    # 부른 쪽이 원한 개수보다 많이 요구할 수는 없다. top_k=2 인데 min_results 가 3이면
    # AND 가 2개를 다 찾아도 부족으로 보고 완화 사다리를 타 버린다.
    min_results = min(min_results, top_k)

    base = index["people"] >= people_min
    for accord in avoid:
        col = index["aidx"].get(accord)
        if col is not None:
            base &= ~index["has"][:, col]

    score = index["strength"][:, cols].sum(axis=1)

    # 조건이 accord 하나뿐인 경우. AND 와 OR 이 같은 집합이라 넓힐 것이 없다.
    # 예전에는 이 경우가 그대로 RELAXED_OR 로 떨어져 "조건을 넓혀 찾았습니다" 가 떴는데
    # 넓힌 적이 없으므로 거짓이었다. 실측상 600문장 중 91건이 그렇게 표시됐다.
    #
    # 그렇다고 AND 로 적으면 안 된다. 넓은 accord 하나로는 향 조건이 순위를 정하지 못하고
    # 인기도가 정한다(citrus 단독은 5위 동점이 17,736개). 사용자에게 알려야 할 상태다.
    # 그래서 단계를 따로 두어 status 는 OK_RELAXED 로 유지하되 이유를 정직하게 적는다.
    # DECISIONS.md N2 — 직역 대응(나무=woody)의 단독 매핑을 허용하며 이 표시를 조건으로 단다.
    if len(cols) == 1:
        mask = base & index["has"][:, cols[0]]
        picked = _rank(index, mask, score, top_k, brand_cap)
        if len(picked["rows"]) >= min_results:
            picked["stage"] = "SINGLE_BROAD"
            picked["relaxed"] = ["향 조건이 accord 하나뿐이라 순위를 정하지 못한다"]
            return picked

    if len(cols) >= MIN_CORE_FOR_AND:
        mask = base.copy()
        for col in cols:
            mask &= index["has"][:, col]
        picked = _rank(index, mask, score, top_k, brand_cap)
        if len(picked["rows"]) >= min_results:
            picked["stage"] = "AND"
            picked["relaxed"] = []
            return picked

    # 완화 4 — AND 를 OR 로 (spec 3장 3의 완화 사다리)
    mask = base & index["has"][:, cols].any(axis=1)
    picked = _rank(index, mask, score, top_k, brand_cap)
    if len(picked["rows"]) >= min_results:
        picked["stage"] = "RELAXED_OR"
        picked["relaxed"] = ["core accord 를 AND 에서 OR 로"]
        return picked

    # 완화 5 — 평가자 문턱 해제
    mask = np.ones(index["n_perfumes"], dtype=bool)
    for accord in avoid:
        col = index["aidx"].get(accord)
        if col is not None:
            mask &= ~index["has"][:, col]
    mask &= index["has"][:, cols].any(axis=1)
    picked = _rank(index, mask, score, top_k, brand_cap)
    picked["stage"] = "RELAXED_OR_NO_THRESHOLD" if picked["rows"] else "NOT_ENOUGH"
    picked["relaxed"] = ["core accord 를 AND 에서 OR 로", "평가자 문턱 해제"]
    return picked


def _rank(index, mask, score, top_k, brand_cap):
    """마스크 안에서 정렬해 상위를 고른다. dict."""
    idx = np.flatnonzero(mask)
    if idx.size == 0:
        return {"rows": [], "candidate_count": 0, "tie_at_last": 0}

    # 1순위 strength 합 내림차순, 2순위 평가자 수 내림차순(동점 깨기), 3순위 id 오름차순
    order = np.lexsort((index["pid"][idx], -index["people"][idx], -score[idx]))
    idx = idx[order]

    sorted_score = score[idx]
    cut = min(top_k, len(idx)) - 1
    tie = int((sorted_score == sorted_score[cut]).sum())

    rows, seen = [], {}
    for row in idx:
        brand = index["brand"][row]
        if brand_cap and seen.get(brand, 0) >= brand_cap:
            continue
        seen[brand] = seen.get(brand, 0) + 1
        rows.append(int(row))
        if len(rows) >= top_k:
            break
    return {"rows": rows, "candidate_count": int(idx.size), "tie_at_last": tie}


# ---------------------------------------------------------------------------
# 3단계 — 근거 계산과 응답 조립
# ---------------------------------------------------------------------------
def recommend(index, text, structured=None, top_k=TOP_K, estimator=None):
    """문장 하나로 추천 응답을 만든다.

    index      : dict            load_index() 결과
    text       : str             사용자 원문
    structured : dict | None     ①단계 구조화 결과. 없으면 사전만 쓴다.
    top_k      : int
    estimator  : callable | None 사전이 못 받은 표현 하나를 받아
                                 {"accords": [...], "reasoning": str} 를 내는 함수.
                                 **조건이 하나도 안 잡혔을 때만** 부른다.

    반환: dict — status / query / conditions / results / diagnostics / unmatched

    **입력은 `structured`, 출력은 `conditions` 다.** 반환값의 `conditions` 를 이 함수의
    `structured` 로 되돌려 넣지 않는다 — 모양이 달라 조건이 0개가 된다.

    이 파일은 네트워크를 모른다. LLM 추정이 필요하면 `estimator` 로 넣는다. 그래야
    DB 도 인터넷도 없이 테스트할 수 있고, 추정 없이도 서비스가 돈다.
    """
    understood = understand(index, text, structured)
    estimate = {}
    if estimator and not understood["core"] and understood["unmatched"]:
        estimate = _apply_estimates(index, understood, estimator)
        if estimate:
            # 추정이 조건을 만들었으므로 source 를 다시 적는다. understand() 가 계산한
            # 값은 추정 전 기준이라 그대로 두면 기여를 빠뜨린다.
            understood["source"] = "llm+lexicon"
    found = search(index, understood["core"], understood["avoid"], top_k=top_k)

    results = []
    for row in found["rows"]:
        matched = []
        for accord in understood["core"]:
            col = index["aidx"].get(accord)
            if col is None:
                continue
            value = float(index["strength"][row, col])
            if value <= 0:
                continue
            source = next((e for e in understood["evidence"] if e["accord"] == accord), None)
            matched.append({
                "accord": accord,
                "strength": int(value),
                "from": source["from"] if source else None,
                "tier": source["tier"] if source else None,
                "rationale": source["rationale"] if source else None,
            })
        matched.sort(key=lambda m: -m["strength"])
        results.append({
            "perfume_id": int(index["pid"][row]),
            "name": index["name"][row],
            "brand": index["brand"][row],
            "people": int(index["people"][row]),
            "rating": round(float(index["rating"][row]), 2),
            "matched": matched,
            "score": sum(m["strength"] for m in matched),
            "avoid_confirmed": understood["avoid"],
        })

    if found["stage"] == "NO_CONDITION":
        status = "NO_CONDITION"
    elif len(results) == 0:
        status = "NO_RESULT"
    elif found["stage"] == "AND":
        status = "OK"
    else:
        status = "OK_RELAXED"

    return {
        "status": status,
        "query": text,
        "conditions": {
            "core": understood["core"],
            "avoid": understood["avoid"],
            "matched_expressions": understood["matched_expressions"],
            "source": understood["source"],
        },
        "results": results,
        "unmatched": understood["unmatched"],
        "llm_estimate": estimate,
        "diagnostics": {
            "stage": found["stage"],
            "candidate_count": found["candidate_count"],
            "tie_at_last": found["tie_at_last"],
            "relaxed": found["relaxed"],
            "unmatched_hint": _unmatched_hint(status),
        },
    }


def _apply_estimates(index, understood, estimator):
    """사전이 못 받은 표현을 추정해 조건에 넣는다. dict[key, dict].

    등급은 `LLM` 이고 **`rationale` 은 비운다.** 사전의 `rationale` 은 사람이 판단한 뒤
    쓴 근거이고 LLM 이 붙인 설명은 사후 해석이다. 한 칸에 섞으면 나중에 구분할 수 없다
    (spec 1장). 추정 설명은 `llm_reasoning` 에 따로 담는다.
    """
    estimate, core = {}, set(understood["core"])
    for item in understood["unmatched"]:
        guess = estimator(item["expression"]) or {}
        accords = [a for a in (guess.get("accords") or []) if a in index["aidx"]]
        if not accords:
            continue
        estimate[item["normalized_key"]] = {"accords": accords,
                                            "reasoning": guess.get("reasoning")}
        for accord in accords:
            if accord in core:
                continue
            core.add(accord)
            understood["evidence"].append({
                "from": item["expression"],
                "accord": accord,
                "tier": "LLM",
                "entry_id": None,
                "rationale": None,
                "llm_reasoning": guess.get("reasoning"),
            })
    understood["core"] = sorted(core - set(understood["avoid"]))
    understood["matched_expressions"] = sorted(
        {e["from"] for e in understood["evidence"] if e.get("from")})
    return estimate


def _unmatched_hint(status):
    """결과를 못 낸 이유를 프론트가 쓸 수 있는 형태로. str 또는 None."""
    if status == "NO_CONDITION":
        return ("문장에서 향 조건을 하나도 찾지 못했다. "
                "사전에 없는 표현이거나 향과 무관한 입력이다. "
                "미매칭 로그에 기록하고 사용자에게 다시 입력을 요청한다.")
    if status == "NO_RESULT":
        return "조건은 찾았으나 완화 후에도 결과가 없다. 조건 조합을 확인한다."
    return None


# ---------------------------------------------------------------------------
def main():
    """명령줄 실행."""
    parser = argparse.ArgumentParser(description="자연어 향수 추천 엔진")
    parser.add_argument("query", nargs="+", help="사용자 문장")
    parser.add_argument("--perfumes", default=None, help=f"기본 {DEFAULT_PERFUMES.name}")
    parser.add_argument("--lexicon", default=None, help=f"기본 {DEFAULT_LEXICON.name}")
    parser.add_argument("--accords", default=None, help=f"기본 {DEFAULT_ACCORDS.name}")
    parser.add_argument("--top-k", type=int, default=TOP_K)
    parser.add_argument("--json", action="store_true", help="JSON 으로 출력")
    args = parser.parse_args()

    index = load_index(args.perfumes, args.lexicon, args.accords)
    for query in args.query:
        out = recommend(index, query, top_k=args.top_k)
        if args.json:
            print(json.dumps(out, ensure_ascii=False, indent=2))
            continue
        print("=" * 78)
        print(f"입력   {out['query']}")
        print(f"조건   {out['conditions']['core']}  "
              f"(표현 {out['conditions']['matched_expressions']})")
        print(f"상태   {out['status']}  단계 {out['diagnostics']['stage']}  "
              f"후보 {out['diagnostics']['candidate_count']:,}")
        if out["diagnostics"]["unmatched_hint"]:
            print(f"안내   {out['diagnostics']['unmatched_hint']}")
        for rank, item in enumerate(out["results"], 1):
            detail = " ".join(f"{m['accord']}={m['strength']}" for m in item["matched"])
            print(f"  {rank}. {item['name'][:34]:36s} {item['brand'][:20]:22s} "
                  f"[{detail}] 평가자 {item['people']:,}")


if __name__ == "__main__":
    main()
