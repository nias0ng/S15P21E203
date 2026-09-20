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
사전 v1.15 기준 합성 600문장에서 조건을 뽑는 비율이 **88.8% -> 76.8%** 로 떨어지지만
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

# 오타 검문소. ⑤단계 앞에서 사전 표면형의 오타를 되돌린다.
# [측정 기록 30번] 자모 거리 1 · 2글자 이상에서 생성 오타 3,775개 중 포착 93.0% ·
# 엉뚱한 표면형으로 교정 0% · 실제 표현 369개에서 오교정 0건이었다.
# 거리 2 로 올리면 사전 표면형끼리 충돌하는 쌍이 0 -> 12쌍이 되어 무엇으로 고칠지 모른다.
TYPO_MAX_DISTANCE = 1
TYPO_MIN_LEN = 2          # 1글자는 후보가 너무 많다. `꿀`·`숲`·`잼`·`탑` 이 서로 이웃이다

# ①단계 구조화 결과에서 이 엔진이 실제로 읽는 칸. 나머지(context·performance)는 안 읽는다 —
# 계절 데이터가 0건이라 아직 검색에 못 쓴다(spec 6장 제약 1).
STRUCTURED_KEYS = ("scent_preference", "avoid", "additional_requirements")

# ①단계 `context` 의 값 -> 배포 데이터 `*_lead` 칸의 값.
# **`neuter` 는 ①단계 프롬프트의 표기**이고 데이터 쪽은 `unisex` 다.
CONTEXT_FIELDS = {
    "gender": ("gender_lead", {"male": "male", "female": "female", "neuter": "unisex"}),
    "season": ("season_lead", {s: s for s in ("spring", "summer", "autumn", "winter")}),
    "daypart": ("daypart_lead", {s: s for s in ("day", "night")}),
}

# 조건을 걸어 후보가 이 수 밑으로 떨어지면 **그 조건을 포기한다.**
# 완화 사다리(MIN_RESULTS)와 같은 정신이다 — 조건을 지키느라 빈손을 주지 않는다.
CONTEXT_MIN = 3

# 기본 데이터 경로. 인자로 덮어쓸 수 있다.
_DATA_DIR = Path(__file__).resolve().parent / "data"
DEFAULT_PERFUMES = _DATA_DIR / "perfumes_nlr.csv.gz"
DEFAULT_LEXICON = _DATA_DIR / "domain_lexicon_v1_17.csv"
DEFAULT_ACCORDS = _DATA_DIR / "accord_dictionary.csv"
DEFAULT_NOTE_BRIDGE = _DATA_DIR / "note_accord_bridge.csv"
DEFAULT_NOTE_ALIAS_KO = _DATA_DIR / "note_alias_ko.csv"
# 오타 검문소가 **건드리면 안 되는 낱말**. EDA 의 `85_protected_words_v1_17.py` 가 만든다.
# **사전 버전이 바뀌면 다시 만들어야 한다** — 표면형이 바뀌면 이 집합도 바뀐다.
DEFAULT_PROTECTED_WORDS = _DATA_DIR / "protected_words_v1_17.txt"

# 사전 파일 이름에서 버전을 뽑는 규칙. `domain_lexicon_v1_17.csv` -> `v1_17`.
_LEXICON_VERSION = re.compile(r"_(v\d+(?:_\d+)*)$")

# [측정] 노트 브리지 문턱. 측정 기록 18·19번.
#
# ①단계가 `scent_preference` 에 accord 이름이 아니라 **노트(원료) 이름** 을 넣는 일이
# 잦다 — 합성 600 에서 256회(31.8%). `_normalize_accord` 는 그것을 통째로 버린다.
# 그중 111회(43.4%)가 이 표로 풀린다.
#
#   p    그 노트를 가진 향수 중 이 accord 를 가진 비율
#   lift p 를 그 accord 의 기저율로 나눈 값. **1 이면 정보가 없다**
#
# `p` 만 쓰면 기저율이 조건으로 섞인다 — `woody` 는 전체 향수의 **63.1%** 가 가지고 있어
# 어떤 노트든 `p >= 0.5` 를 넘긴다(129,161개 직접 계수. 평가자 10명 이상만 보면 64.5%).
# `peony -> woody` 는 p 0.536 인데 lift 0.87 로 **작약이 있으면 오히려 덜 나온다.**
# 그래서 lift 를 함께 건다.
#
# 1.4 는 DECISIONS.md N4 의 통제군이 정한 값이다(무작위 집단에서 1.17·1.38·1.14).
# 72번 스윕에서 **0~1.6 구간은 NDCG 가 서로 갈리지 않고 1.7 부터 확실히 나빠진다.**
# 그 평지 안에서 유일하게 근거가 있는 값이라 1.4 를 골랐다.
#
# **BRIDGE_P_MIN 은 지금 배포된 CSV 에서 한 행도 거르지 않는다.** 그 파일을 만들 때
# 이미 `p >= 0.5` 로 걸러 넣었기 때문이다(`p` 최솟값이 정확히 0.5000).
# 실제로 거르는 것은 lift 뿐이다 — 2,925행 중 987행. **빼지 않고 두는 이유는 표를
# 다시 만들 때 `p < 0.5` 인 행이 들어올 수 있어서다.** search_rules.md 에도 적었다.
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
               bridge_lift_min=BRIDGE_LIFT_MIN, protected_words=None,
               note_alias_ko=None):
    """향수 데이터와 사전을 읽어 조회용 인덱스를 만든다.

    perfumes_csv : str | Path | None   기본 data/perfumes_nlr.csv.gz
    lexicon_csv  : str | Path | None   기본 data/domain_lexicon_v1_17.csv
    accord_csv   : str | Path | None   기본 data/accord_dictionary.csv (accord 92개 마스터)
    verify       : bool                accord 보유 수를 마스터와 대조해 틀리면 RuntimeError
    bridge_csv   : str | Path | None   기본 data/note_accord_bridge.csv (노트→accord)
                                       **없어도 엔진은 돈다.** 경고를 남기고 노트를 해석하지
                                       않는다 — 코드만 먼저 배포한 경우를 막지 않는다
    note_alias_ko: str | Path | None   기본 data/note_alias_ko.csv (한국어 별칭→노트)
                                       **없어도 엔진은 돈다.** 한국어 노트 이름이 브리지로
                                       풀리지 않고 ⑤단계로 갈 뿐이다 (측정 기록 34번)
    bridge_p_min : float               기본 BRIDGE_P_MIN
    bridge_lift_min : float            기본 BRIDGE_LIFT_MIN
    protected_words : str | Path | None 기본 data/protected_words_v1_17.txt (오타 검문소).
                                       **없으면 검문소를 끈다.** 경고를 남긴다

    무겁다. 13만 x 92 행렬을 만드므로 **기동 시 한 번만 부르고 재사용한다.**

    반환: dict — recommend() 에 그대로 넘긴다.
    """
    perfumes_csv = Path(perfumes_csv) if perfumes_csv else DEFAULT_PERFUMES
    lexicon_csv = Path(lexicon_csv) if lexicon_csv else DEFAULT_LEXICON
    accord_csv = Path(accord_csv) if accord_csv else DEFAULT_ACCORDS

    # `context` 세 칸은 **있으면 읽고 없으면 넘어간다.** 코드를 데이터보다 먼저
    # 배포하는 경우를 막지 않는다 — 없으면 `_load_context` 가 경고를 남긴다.
    needed = ["id", "name", "brand", "accords", "people", "rating_avg"]
    optional = [column for column, _ in CONTEXT_FIELDS.values()] + ["notes"]
    available = set(pd.read_csv(perfumes_csv, nrows=0).columns)
    missing = [c for c in needed if c not in available]
    if missing:
        raise RuntimeError(f"배포 데이터에 필수 칸이 없다: {missing} ({perfumes_csv})")
    perf = pd.read_csv(
        perfumes_csv,
        usecols=needed + [c for c in optional if c in available],
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
    context = _load_context(perf)
    notes = _load_notes(perf)
    alias_ko, alias_target = _add_note_alias_ko(
        note_bridge,
        Path(note_alias_ko) if note_alias_ko else DEFAULT_NOTE_ALIAS_KO)
    _check_lowercase(notes, alias_target)

    return {
        "accords": accords,
        "aidx": aidx,
        "note_bridge": note_bridge,
        "note_alias_ko": tuple(sorted(alias_ko, key=len, reverse=True)),
        "note_alias_target": alias_target,
        "context": context,
        "notes": notes,
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
        "lexicon_version": lexicon_version(lexicon_csv),
        "n_perfumes": len(perf),
        **_load_typo_gate(Path(protected_words) if protected_words
                          else DEFAULT_PROTECTED_WORDS, surface),
    }


def _load_typo_gate(path, surface):
    """오타 검문소가 쓸 두 집합. dict.

    protected_words   교정하면 안 되는 낱말. 진짜 한국어이거나 향 전문 용어다
    typo_targets      교정 후보가 될 사전 표면형 -> 그 자모 표기

    **목록 파일이 없어도 엔진은 돈다.** 경고를 남기고 검문소를 끈다 — 노트 브리지와 같은
    방침이다. 목록 없이 검문소를 돌리면 `너무` 를 `나무` 로 고치므로 **끄는 편이 안전하다**
    [측정 기록 30번 · 목록 없이는 실제 표현의 10.3% 가 망가진다].
    """
    targets = {f: _to_jamo(f) for f in surface
               if " " not in f and len(f) >= TYPO_MIN_LEN}
    path = Path(path)
    if not path.is_file():
        LOGGER.warning("보호 낱말 목록이 없다: %s. **오타 검문소를 끈다** — "
                       "목록 없이 교정하면 멀쩡한 낱말을 바꾼다", path)
        return {"protected_words": None, "typo_targets": targets}
    words = {w for w in path.read_text(encoding="utf-8").split("\n") if w}
    LOGGER.info("오타 검문소 켜짐 — 보호 낱말 %d개 · 교정 후보 표면형 %d개",
                len(words), len(targets))
    return {"protected_words": words, "typo_targets": targets}


def lexicon_version(path=None):
    """그 사전 파일의 버전. str 또는 None.

    path : str | Path | None   기본 DEFAULT_LEXICON

    **파일 이름에서 뽑는다.** `domain_lexicon_v1_17.csv` -> `'v1_17'`.

    **왜 파일 이름인가** — 이 값은 응답으로 나가 `nlr_recommendations.lexicon_version`
    에 쌓인다. 목적이 *"반년 뒤에 이 기록이 어느 사전에서 나왔는지 해석하는 것"* 이라
    **사람이 읽을 수 있어야 한다.** 파일 내용 해시를 쓰면 정확하지만 읽을 수 없다.
    DB 칸도 `VARCHAR(20)` 이고 `'v1_14'` 를 예시로 적어 두었다.

    **⚠ 한계 — 파일을 복사해 이름을 바꾸면 틀린 값이 나간다.** 이름 규칙에 안 맞으면
    `None` 을 돌려주므로 *"모른다"* 가 `NULL` 로 남는다. 틀린 값보다 낫다 — 없으면
    모른다는 것을 알지만 틀리면 아는 줄 착각한다.

    측정 스크립트가 임시 파일로 사전을 실험할 때가 여기 걸린다. 그때는 `None` 이 맞다.
    """
    name = Path(path).stem if path else DEFAULT_LEXICON.stem
    found = _LEXICON_VERSION.search(name)
    return found.group(1) if found else None


def _check_lowercase(notes, alias_target):
    """노트 이름이 전부 소문자인지 확인한다. None — 아니면 RuntimeError.

    notes        : dict | list  `_load_notes` 결과 (노트 이름 -> 행)
    alias_target : dict | None  별칭 -> 영어 노트 이름. None 이면 이 표를 안 본다

    **`note_rows` 가 소문자끼리 견주는 것을 전제로 한다.** 배포 데이터는
    `build_data._notes()` 가, 별칭표는 `_add_note_alias_ko` 가 각각 낮춘다.
    **세 군데가 따로 낮추므로 하나만 빠져도 조용히 안 걸린다** — 348 에서
    `set.update` 가 문자열을 쪼갠 것과 같은 실패 방식이라 여기서 못 박는다 [MR 리뷰].

    기동할 때 한 번만 돈다.
    """
    bad = [n for n in (notes or ()) if n != n.lower()]
    if bad:
        raise RuntimeError(
            f"배포 데이터의 노트 이름에 대문자가 있다: {sorted(bad)[:5]}. "
            "build_data.py 가 소문자로 낮춰야 한다")
    if alias_target:
        bad = [f"{k} -> {v}" for k, v in alias_target.items()
               if k != k.lower() or v != v.lower()]
        if bad:
            raise RuntimeError(
                f"노트 별칭에 대문자가 있다: {sorted(bad)[:5]}. "
                "_add_note_alias_ko 가 소문자로 낮춰야 한다")


def _load_notes(perf):
    """노트 이름 -> 그 노트를 가진 향수 행. dict[str, np.ndarray[bool]].

    perf : DataFrame  배포 데이터. `notes` 칸을 본다 (`amber|basil|cedar`)

    **역색인으로 만든다.** 요청마다 향수 13만 개를 훑으면 검색이 4.4ms 에서 135ms 로
    30배 느려진다 [측정]. 노트 어휘는 2,519종뿐이라 이름으로 찾는 편이 훨씬 싸다.

    **칸이 없어도 엔진은 돈다.** 코드를 데이터보다 먼저 배포하는 경우를 막지 않는다 —
    경고를 남기고 노트로 정렬하지 않는다.

    이름은 `build_data.py` 가 이미 소문자로 낮춰 뒀다.
    """
    if "notes" not in perf.columns:
        LOGGER.warning(
            "배포 데이터에 notes 칸이 없다. 말한 노트를 가진 향수를 앞으로 당기지 "
            "못한다 — build_data.py 를 다시 돌려야 한다")
        return {}
    where = {}
    for row, cell in enumerate(perf["notes"].fillna("").astype(str)):
        if not cell:
            continue
        for note in cell.split("|"):
            where.setdefault(note, []).append(row)
    return {note: np.array(rows, dtype=np.int64) for note, rows in where.items()}


def _load_context(perf):
    """`*_lead` 칸을 조회용 불리언 행렬로 만든다. dict[str, dict[str, np.ndarray]].

    perf : DataFrame  배포 데이터. `gender_lead`·`season_lead`·`daypart_lead` 를 본다

        index["context"]["season"]["summer"][행] -> 그 향수가 여름 1등인가

    ①단계가 `context.season` 등을 뽑는데 엔진이 안 읽어 버려지고 있었다.
    실사용자 설문에서 season·gender 가 각각 19.6% 에 나온다 [측정 기록 35번].

    **칸이 없어도 엔진은 돈다.** 코드만 먼저 배포하고 데이터가 아직 옛 파일인 경우를
    막지 않는다 — 경고를 남기고 그 조건을 안 건다.

    **값은 `|` 로 이어진 동률 목록이다** (`winter|autumn`). 투표가 전부 0이면 빈칸이고,
    그 향수는 어느 쪽으로도 세지 않는다.
    """
    out = {}
    for field, (column, mapping) in CONTEXT_FIELDS.items():
        if column not in perf.columns:
            LOGGER.warning(
                "배포 데이터에 %s 칸이 없다. ①단계의 context.%s 조건을 못 건다 "
                "— build_data.py 를 다시 돌려야 한다", column, field)
            continue
        raw = perf[column].fillna("").astype(str).to_numpy()
        table = {}
        for value in dict.fromkeys(mapping.values()):
            table[value] = np.array([value in cell.split("|") for cell in raw])
        out[field] = table
    return out


def _add_note_alias_ko(bridge, path):
    """노트 브리지에 한국어 별칭 키를 더한다. (list[str], dict[str, str]).

    돌려주는 것은 **더한 키**와 **그 키가 가리키는 영어 노트 이름**이다.
    영어 이름은 348 이 카탈로그의 노트와 견주는 데 쓴다.

    bridge : dict   `_load_note_bridge` 가 만든 dict. **이 자리에서 고친다**
    path   : Path   alias · note 두 칸을 가진 CSV

    ①단계 LLM 이 `scent_preference` 에 **한국어 노트 이름**을 넣는데 브리지 표는 전부
    영어라 통째로 버려진다 [측정 기록 34번]. `미모사` 가 그래서 ⑤단계로 떨어졌고
    LLM 이 *"샴페인 칵테일"* 로 해석했다.

        "미모사"  ->  (없음)                        이 표를 얹기 전
        "미모사"  ->  powdery · floral · yellow floral

    **`note_accord_bridge.csv` 에는 한글 행을 안 넣는다.** 그 파일은 코퍼스 통계
    (`p` · `lift`)이고 별칭은 번역이라 섞으면 한글 행의 `p` · `lift` 를 지어내야 한다.
    그래서 파일은 그대로 두고 **읽어 들인 dict 에만** 영어 이름의 값을 가리키는 키를
    더한다. 두 키가 같은 tuple 을 가리킨다.

    **영어 이름이 브리지에 없으면 건너뛴다.** 문턱(`p` · `lift`)에 걸려 빠진 노트는
    별칭을 붙여도 줄 값이 없다.

    **파일이 없으면 경고만 남긴다.** 노트 브리지와 같은 방침이다 — 한국어 노트 이름이
    이 표를 얹기 전처럼 ⑤단계로 갈 뿐 엔진은 정상 동작한다.
    """
    if not bridge:
        return [], {}
    if not Path(path).exists():
        LOGGER.warning(
            "노트 별칭 파일이 없다: %s. 한국어 노트 이름(`미모사` 등)은 브리지로 풀리지 "
            "않고 ⑤단계로 간다", path)
        return [], {}

    table = pd.read_csv(path)
    missing = [c for c in ("alias", "note") if c not in table.columns]
    if missing:
        raise RuntimeError(f"노트 별칭에 필요한 칸이 없다: {missing} ({path})")

    added, skipped, target = [], 0, {}
    for alias, note in zip(table["alias"], table["note"]):
        key = re.sub(r"\s+", " ", str(alias).strip().lower())
        eng = re.sub(r"\s+", " ", str(note).strip().lower())
        if not key or key == "nan" or len(key) < 2:
            continue                      # 한 글자는 다른 낱말에 박힌다 (34번)
        if eng not in bridge:
            skipped += 1
            continue
        if key in bridge:
            continue                      # 영어 이름과 겹치면 원래 값을 지킨다
        bridge[key] = bridge[eng]
        target[key] = eng
        added.append(key)
    LOGGER.info("노트 별칭 %d개를 얹었다 (영어 이름이 브리지에 없어 건너뛴 것 %d) %s",
                len(added), skipped, Path(path).name)
    return added, target


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

        # ①단계가 쓴 문장 안에 **박혀 있는** 한국어 노트 이름도 찾는다.
        # 위의 `scent_preference` 경로는 표현 전체가 노트 이름일 때만 풀린다 —
        # `무화과 향이 나는 여성스러운향` 처럼 문장이면 통째로 못 찾는다 [34번].
        #
        # ⚠ **여기서 푼 표현도 `_unmatched` 에는 그대로 남는다.** 그 함수는 사전이
        # 잡은 표면형만 보고 브리지는 안 본다 (설문 2.8% · 합성 12.3% 의 표현).
        #
        # **동작에는 영향이 없다.** `recommend()` 는 core 가 비었을 때만 ⑤단계를
        # 부르므로(`if estimator and not understood["core"]`) 여기서 core 를 채우면
        # ⑤단계는 안 돈다 — 오히려 호출이 준다(합성 600 에서 237 -> 193).
        # 남는 것은 `nlr_unmatched_expressions` 의 정확도다. 로그를 캐서 사전을
        # 늘리려는 쪽이 **이미 풀린 것을 빈칸으로 본다.** 고치려면 `unmatch_reason`
        # 에 네 번째 값이 필요해 응답 계약이 바뀌므로 **범위에 넣지 않았다.**
        for raw in (structured.get("additional_requirements") or []):
            for alias in _longest_alias_ko(index, raw):
                core.update(_bridge_lookup(index, alias))

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
    """LLM 이 뽑았으나 **조건을 하나도 못 만든** 표현. list[dict].

    조건이 잡힌 요청에서도 남은 표현을 전부 기록한다. 실측상 조건이 잡힌 쿼리 속에
    숨은 미매칭이 합성 600건에서 1,339회 있었고, 조건 0건만 보면 그게 안 보인다.

    **사전이 잡은 것과 브리지가 푼 것을 둘 다 뺀다.** 346 이 한국어 노트 별칭을
    `additional_requirements` 에 태우면서 **조건을 만들었는데도 "사전에 없는 표현"
    으로 기록되는 표현이 생겼다** — 설문 9개 · 합성 169개다 [측정 기록 35번].
    346 이전에는 설문 0 · 합성 1 이었으니 그때 들어온 회귀다.

    이 로그는 `nlr_unmatched_expressions` 로 가서 **사전을 늘릴 근거**로 쓰인다.
    이미 풀린 것이 섞이면 그만큼 헛짚는다.
    """
    if not structured:
        return []
    # **대표(`from`)만 보면 안 된다.** 대표는 haystack 전체에서 고른 화면용이라
    # 이 표현 안에는 없을 수 있다. 같은 항목이 걸린 표면형 전부를 본다.
    matched = {e["from"] for e in evidence if e.get("from")}
    for item in evidence:
        matched |= set(item.get("matched_forms") or ())
    out = []
    for raw in (structured.get("additional_requirements") or []):
        expression = unicodedata.normalize("NFC", str(raw)).strip()
        if not expression:
            continue
        if any(form in expression for form in matched):
            continue          # 이 표현 안에서 사전이 무언가를 잡았다
        if _bridge_resolved(index, expression):
            continue          # 브리지가 풀어 조건이 생겼다 (346)
        reason, entry_id = _classify_unmatch(index, expression, haystack)
        out.append({
            "expression": expression,
            "normalized_key": re.sub(r"\s+", " ", expression).lower(),
            "unmatch_reason": reason,
            "entry_id": entry_id,
        })
    return out


def _bridge_resolved(index, expression):
    """이 표현을 노트 브리지가 풀어 조건이 생겼나. bool.

    index      : dict  load_index() 결과
    expression : str   ①단계가 쓴 문장 하나

    **`understand()` 의 브리지 경로와 똑같이 본다.** 거기서 core 에 넣는 조건을
    여기서 미매칭으로도 적으면 같은 표현이 두 곳에 들어간다.

        "무화과 향이 나는 여성스러운향"  ->  True   (fig -> fruity · sweet)
        "은은하고 깨끗한 느낌"          ->  False  (브리지에 없다)

    ⚠ **두 곳이 같은 규칙을 쓴다.** `understand()` 쪽을 고치면 여기도 함께 고쳐야
    한다 — 안 그러면 조용히 어긋나 이 버그가 되돌아온다.
    """
    text = re.sub(r"\s+", " ", str(expression).strip().lower())
    if _bridge_lookup(index, text):
        return True
    return any(_bridge_lookup(index, alias)
               for alias in _longest_alias_ko(index, text))


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
    """사전에서 표현을 찾아 core accord 와 근거를 낸다. (set, list).

    **`evidence["from"]` 은 사용자가 쓴 표면형이다.** 사전 항목의 대표 이름이 아니다 —
    계약 문서(`docs/nlr_api_contract.md` `matched[].from`)가 *"사용자가 쓴 표현"* 으로
    정의했고 프론트가 그것을 `phrase` 에 그대로 쓴다.

        "숲속의 비 맞은 진흙"   표면형 `숲` 이 걸린다. 그 항목의 대표 이름은 `나무` 다
                             항목 이름을 내보내면 화면에 *"'나무' 때문에 추천"* 이 뜬다

    **한 항목에 표면형이 여럿 걸리면 가장 긴 것을 쓴다.** 사용자가 쓴 말 중 가장 구체적인
    것이 남는다 — `화이트 머스크` 와 `머스크` 가 함께 걸리면 앞의 것이다. 같은 길이면
    원문에 먼저 나온 것이다.
    """
    # 항목 -> (대표 표면형, 순위, 걸린 표면형 전부)
    #
    # **대표는 화면용이고 `forms` 는 미매칭 판정용이다.** 대표 하나만 남기면
    # `_unmatched()` 가 "이 표현 안에서 사전이 뭔가 잡았나" 를 잘못 본다 —
    # haystack 전체에서 고른 대표가 그 표현 안에는 없을 수 있다.
    hit = {}
    for form, expressions in index["lexicon_surface"].items():
        if not form or form not in haystack:
            continue
        rank = (-len(form), haystack.find(form))     # 긴 것 · 같으면 먼저 나온 것
        for expression in expressions:
            best, prev, forms = hit.get(expression, (None, None, set()))
            forms.add(form)
            if best is None or rank < prev:
                best, prev = form, rank
            hit[expression] = (best, prev, forms)

    core, evidence = set(), []
    for expression in sorted(hit):
        form, _, forms = hit[expression]
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
                "from": form,
                # 같은 항목을 걸리게 한 표면형 전부. `_unmatched()` 만 쓴다.
                # **응답에 나가지 않는다** — `server.py` 가 계약에 있는 칸만 고른다
                "matched_forms": sorted(forms),
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


def _longest_alias_ko(index, raw):
    """문장에 박힌 한국어 노트 별칭. list[str] (겹치면 **가장 긴 것**).

    index : dict   load_index() 결과. `note_alias_ko` 가 없으면 빈 목록이다
    raw   : str    ①단계가 쓴 문장 하나

        "무화과 향이 나는 여성스러운향"   ->  ["무화과"]
        "로즈마리 녹차 레몬"            ->  ["로즈마리", "녹차", "레몬"]
        "망고나 파인애플 같은"           ->  ["파인애플", "망고"]

    **겹치면 긴 것만 쓴다.** 별칭 196개 중 서로 박히는 쌍이 **31개**이고 그중 뜻이
    틀어지는 것이 **7개**다.

        로즈마리 · 로즈메리 · 튜베로즈   안의 `로즈`     -> rose 가 잘못 붙는다
        파인애플                    안의 `애플`     -> apple
        오렌지꽃 · 오렌지 블라썸        안의 `오렌지`    -> orange
        산딸기                     안의 `딸기`     -> strawberry (산딸기는 raspberry 다)

    나머지 24쌍은 무해하다 (`시더우드`->cedar · `화이트머스크`->musk · `청사과`->apple).
    **343 이 `_lexicon_lookup` 에 넣은 것과 같은 규칙이다** — 한국어는 교착어라 부분
    문자열로 찾을 수밖에 없고, 그러면 긴 것이 이긴다.

    **원문(`text`)에는 쓰지 않는다.** ①단계를 거친 문장만 본다. 원문을 훑으면
    `머스크는 싫어` 의 `머스크` 까지 집어 회피 표현이 조건이 된다 [측정 · 설문 10문장].
    """
    aliases = index.get("note_alias_ko") or ()
    text = re.sub(r"\s+", " ", str(raw).strip().lower())
    hit = [a for a in aliases if a in text]
    return [a for a in hit if not any(a != b and a in b for b in hit)]


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
def note_rows(index, structured):
    """사용자가 말한 노트를 가진 향수. np.ndarray[bool] | None.

    index      : dict         load_index() 결과
    structured : dict | None  ①단계 구조화 결과

        "무화과 향이 나는 여성스러운향" -> fig 를 가진 향수 True

    **찾는 방법이 `_longest_alias_ko` 와 같다** — ①단계가 쓴 문장 안에서 한국어 별칭을
    최장 일치로 찾고, 그 별칭이 가리키는 영어 노트 이름을 쓴다(346). `scent_preference`
    에 영어 노트 이름이 직접 오는 경우도 받는다.

    **노트 이름은 부분 문자열로 견준다.** 카탈로그가 `white jasmine` · `jasmine sambac`
    처럼 수식어를 붙여 두어 정확히 일치시키면 대부분 놓친다.

    말한 노트가 없거나 `notes` 칸이 없으면 `None` 이다 — 부른 쪽이 정렬을 안 바꾼다.
    """
    where = index.get("notes")
    if not where or not structured:
        return None
    bridge = index.get("note_bridge") or {}
    wanted = set()
    for field in ("additional_requirements", "scent_preference"):
        for raw in (structured.get(field) or []):
            text = re.sub(r"\s+", " ", str(raw).strip().lower())
            for alias in _longest_alias_ko(index, text):
                wanted.add(alias)
            # 영어 노트 이름이 직접 온 경우. **accord 이름은 뺀다** —
            # 그건 `understand()` 가 core 로 넣어 strength 가 이미 정렬한다.
            # 노트 키로 또 걸면 같은 조건이 두 번 순위를 흔든다.
            if text in bridge and not _normalize_accord(index, text):
                wanted.add(text)
    if not wanted:
        return None
    # **한국어 별칭은 영어 이름으로 바꿔야 카탈로그와 견줄 수 있다.**
    # 한글을 그대로 두면 아무 노트와도 안 맞고, 영어 이름을 set 에 `update` 로 넣으면
    # 문자열이 글자 단위로 쪼개져 `m` 이 거의 모든 노트에 걸린다.
    alias_target = index.get("note_alias_target") or {}
    targets = {alias_target.get(name, name) for name in wanted}
    hit = np.zeros(index["n_perfumes"], dtype=bool)
    for note, rows in where.items():          # 어휘 2,519종만 훑는다
        if any(t in note for t in targets):
            hit[rows] = True
    return hit if hit.any() else None


def context_mask(index, structured, base):
    """①단계의 `context` 조건으로 후보를 좁힌다. (np.ndarray[bool], list[str]).

    index      : dict            load_index() 결과
    structured : dict | None     ①단계 구조화 결과
    base       : np.ndarray[bool] 좁히기 전 후보

        "여름에 쓸 남성용 향수" -> season=summer · gender=male 로 두 번 좁힌다

    **한 칸씩 걸고, 후보가 `CONTEXT_MIN` 밑으로 떨어지면 그 칸은 포기한다.**
    조건을 다 지키느라 빈손을 주는 것보다 낫다 — 완화 사다리와 같은 판단이다.

    두 번째 반환값은 **실제로 걸린 칸 이름**이다. 포기한 칸은 안 들어간다.
    `search()` 가 말한 노트로 한 번 더 좁히면 거기에 `"note"` 를 더한다 (38번).

    **①단계 출력이 스키마를 어겨도 죽지 않는다.** 실측상 98% 만 지킨다 [측정 기록 14번].
    어긴 것은 **경고를 남긴다** — 조용히 무시하면 "왜 여름 조건이 안 걸리지" 를 로그로도
    못 찾는다.
    """
    applied = []
    if not structured:
        return base, applied
    ctx = structured.get("context")
    if ctx is None:
        return base, applied
    if not isinstance(ctx, dict):
        LOGGER.warning("structured['context'] 가 dict 가 아니다: %r. context 조건을 건너뛴다",
                       ctx)
        return base, applied
    for field, (_, mapping) in CONTEXT_FIELDS.items():
        table = (index.get("context") or {}).get(field)
        if not table:
            continue
        values, unknown = _context_values(ctx.get(field), mapping, field)
        if unknown:
            LOGGER.warning("context.%s 에 모르는 값이 있다: %s. 허용값은 %s 다",
                           field, sorted(unknown), sorted(mapping))
        if not values:
            continue
        want = np.zeros(len(base), dtype=bool)
        for value in values:
            want |= table[value]
        narrowed = base & want
        if narrowed.sum() >= CONTEXT_MIN:
            base = narrowed
            applied.append(field)
    return base, applied


def _context_values(raw, mapping, field):
    """①단계가 준 값을 허용값 집합으로 바꾼다. (set[str], set[str]) — 푼 것과 못 푼 것.

    raw     : 무엇이든    ①단계 출력. 리스트를 기대하지만 아닐 수 있다
    mapping : dict       허용값 -> 데이터 쪽 값
    field   : str        경고에 쓸 칸 이름

        ["summer"]   -> ({"summer"}, set())
        "summer"     -> ({"summer"}, set())      **문자열 하나면 한 값으로 본다**
        ["여름"]      -> (set(), {"여름"})
        [["summer"]] -> (set(), {"['summer']"})

    **문자열을 그대로 순회하면 글자 단위로 쪼개져 조건이 조용히 사라진다.**
    `"summer"` 가 `s`·`u`·`m`... 이 되어 아무것도 안 걸리고 경고도 안 남는다.
    """
    if raw is None or raw == "":
        return set(), set()
    items = [raw] if isinstance(raw, str) else raw
    try:
        items = list(items)
    except TypeError:                       # 숫자 등 순회할 수 없는 값
        items = [raw]
    good, bad = set(), set()
    for item in items:
        if not isinstance(item, str):
            bad.add(repr(item))
            continue
        target = mapping.get(item.strip().lower())
        (good.add(target) if target else bad.add(item))
    return good, bad


def search(index, core, avoid=(), top_k=TOP_K, people_min=PEOPLE_MIN,
           brand_cap=BRAND_CAP, min_results=MIN_RESULTS, structured=None):
    """조건으로 향수를 찾아 정렬한다.

    structured : dict | None  ①단계 구조화 결과. 주면 `context` 로 후보를 좁힌다

    반환: dict — rows / stage / candidate_count / tie_at_last / relaxed / context_applied
    """
    cols = [index["aidx"][a] for a in core if a in index["aidx"]]
    if not cols:
        return {"rows": [], "stage": "NO_CONDITION", "candidate_count": 0,
                "tie_at_last": 0, "relaxed": [], "context_applied": []}

    # 부른 쪽이 원한 개수보다 많이 요구할 수는 없다. top_k=2 인데 min_results 가 3이면
    # AND 가 2개를 다 찾아도 부족으로 보고 완화 사다리를 타 버린다.
    min_results = min(min_results, top_k)

    base = index["people"] >= people_min
    for accord in avoid:
        col = index["aidx"].get(accord)
        if col is not None:
            base &= ~index["has"][:, col]

    # ①단계가 말한 성별·계절·낮밤으로 후보를 좁힌다. **정렬은 안 건드린다**
    # (DECISIONS.md N9 — 순서는 향 조건이 정하고 인기도가 동점만 푼다).
    base, context_applied = context_mask(index, structured, base)

    # 사용자가 말한 노트를 가진 향수를 앞으로 당긴다 (348). 말한 노트가 없으면 None 이라
    # 정렬이 그대로다 — **노트를 말하지 않은 문장의 순서는 안 바뀐다.**
    notes = note_rows(index, structured)

    # **말한 노트로 후보도 좁힌다** [측정 기록 38번]. 348 은 정렬만 바꿨는데, accord
    # 조건을 여럿 만족하는 좁은 후보 안에 그 노트를 가진 향수가 아예 없으면 정렬로는
    # 못 고친다 — 실측상 노트를 말한 문장의 7~8% 가 그렇다.
    #
    # `context_mask` 와 **같은 되돌리기**를 쓴다. 좁혀서 후보가 `CONTEXT_MIN` 밑으로
    # 떨어지면 포기한다. 측정에서는 포기가 0건이었지만(설문 30 · 합성 280 전부 통과)
    # 희귀한 노트를 말하는 입력을 막지 않는다.
    #
    # ⚠ **정렬 키(`notes`)는 그대로 둔다.** 조건을 포기한 문장에서는 정렬이 계속 일한다.
    #
    # 얻는 것은 노트 일치(추천 5개 중)가 설문 4.70 -> 5.00 · 합성 4.80 -> 4.95 다.
    # accord NDCG 는 -0.000322 [-0.002568, +0.002050] 로 **손해가 없다** — 좋아지는
    # 것이 아니라 안 잃는 것이다. 쿼리가 말한 노트를 정답 향수가 실제로 갖는 비율이
    # 65.4% 라(35번) 좁히면 정답이 빠지는 경우가 있고, 그것이 오름 5 · 내림 9 로 상쇄됐다.
    if notes is not None:
        narrowed = base & notes
        if narrowed.sum() >= CONTEXT_MIN:
            base = narrowed
            context_applied = list(context_applied) + ["note"]

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
        picked = _rank(index, mask, score, top_k, brand_cap, notes)
        if len(picked["rows"]) >= min_results:
            picked["stage"] = "SINGLE_BROAD"
            picked["relaxed"] = ["향 조건이 accord 하나뿐이라 순위를 정하지 못한다"]
            picked["context_applied"] = context_applied
            return picked

    if len(cols) >= MIN_CORE_FOR_AND:
        mask = base.copy()
        for col in cols:
            mask &= index["has"][:, col]
        picked = _rank(index, mask, score, top_k, brand_cap, notes)
        if len(picked["rows"]) >= min_results:
            picked["stage"] = "AND"
            picked["relaxed"] = []
            picked["context_applied"] = context_applied
            return picked

    # 완화 4 — AND 를 OR 로 (spec 3장 3의 완화 사다리)
    mask = base & index["has"][:, cols].any(axis=1)
    picked = _rank(index, mask, score, top_k, brand_cap, notes)
    if len(picked["rows"]) >= min_results:
        picked["stage"] = "RELAXED_OR"
        picked["relaxed"] = ["core accord 를 AND 에서 OR 로"]
        picked["context_applied"] = context_applied
        return picked

    # 완화 5 — 평가자 문턱 해제.
    # **여기서는 context 조건도 함께 풀린다.** 마스크를 처음부터 다시 만들기 때문이고,
    # 그게 맞다 — 이 단계는 "아무거나 찾아 달라" 는 마지막 수단이다.
    mask = np.ones(index["n_perfumes"], dtype=bool)
    for accord in avoid:
        col = index["aidx"].get(accord)
        if col is not None:
            mask &= ~index["has"][:, col]
    mask &= index["has"][:, cols].any(axis=1)
    picked = _rank(index, mask, score, top_k, brand_cap, notes)
    picked["stage"] = "RELAXED_OR_NO_THRESHOLD" if picked["rows"] else "NOT_ENOUGH"
    picked["relaxed"] = ["core accord 를 AND 에서 OR 로", "평가자 문턱 해제"]
    picked["context_applied"] = []          # 이 단계는 context 도 함께 풀었다
    return picked


def _rank(index, mask, score, top_k, brand_cap, notes=None):
    """마스크 안에서 정렬해 상위를 고른다. dict.

    notes : np.ndarray[bool] | None  사용자가 말한 노트를 가진 향수. **최상위 키**가 된다

    **`notes` 를 주면 N9 의 정렬 규칙이 바뀐다.** 향 조건(strength)보다 노트 보유가
    앞선다. 사용자가 `미모사` 라고 말했으면 미모사가 든 향수를 먼저 보여 주는 것이
    맞다는 판단이다 [측정 기록 35번 · DECISIONS.md N9 추기].

        노트 일치   설문 2.00 -> 4.64 · 합성 2.94 -> 4.85  (5개 중)
        확장 NDCG  +0.010286 [+0.005849, +0.014938] 유의
        accord    0.643833 -> 0.640468  **조금 내려간다.** 그 대가다
    """
    idx = np.flatnonzero(mask)
    if idx.size == 0:
        return {"rows": [], "candidate_count": 0, "tie_at_last": 0}

    # **`np.lexsort` 는 마지막 인자를 1순위로 쓴다.** 그대로 쓰면 코드가 주석과
    # 거꾸로 읽혀, 나중에 키를 하나 얹는 사람이 모르는 새 1순위를 빼앗는다 [MR 리뷰].
    # 그래서 **1순위부터 적고 뒤집어서** 넘긴다.
    ranking = []
    if notes is not None:
        ranking.append(-notes[idx].astype(np.int8))   # 1순위 말한 노트를 가졌나
    ranking.append(-score[idx])                       # 2순위 strength 합
    ranking.append(-index["people"][idx])             # 3순위 평가자 수
    ranking.append(index["pid"][idx])                 # 4순위 id (흔들림 방지)
    idx = idx[np.lexsort(tuple(reversed(ranking)))]

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
_CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
_JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
_JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"
_HANGUL_WORD = re.compile(r"[가-힣]+")


def _to_jamo(text):
    """한글을 자모로 편다. str.

    **음절이 아니라 자모로 재는 것이 검문소의 전제다.** `빨레`/`빨래` 는 글자로는 한 글자
    차이지만 자모로는 `ㅐ`/`ㅔ` 한 개 차이다. 음절 단위로 재면 사전 표면형끼리 충돌하는
    쌍이 28쌍인데 자모 단위로는 0쌍이고, 설문 낱말 교정 대상이 204개에서 12개로 준다
    [측정 기록 30번].
    """
    out = []
    for ch in unicodedata.normalize("NFC", str(text)):
        code = ord(ch) - 0xAC00
        if 0 <= code < 11172:
            out.append(_CHO[code // 588])
            out.append(_JUNG[(code % 588) // 28])
            jong = _JONG[code % 28]
            if jong != " ":
                out.append(jong)
        else:
            out.append(ch)
    return "".join(out)


def _jamo_distance_at_most(a, b, cap=TYPO_MAX_DISTANCE):
    """레벤슈타인 거리가 cap 이하면 그 값, 넘으면 cap+1. int.

    cap 을 넘는 순간 끊는다. 낱말 하나를 표면형 200여 개와 대므로 이 가지치기가 있어야
    요청 지연에 영향을 주지 않는다.
    """
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        if min(cur) > cap:
            return cap + 1
        prev = cur
    return prev[-1]


def _typo_candidates(index, word):
    """이 낱말을 고칠 수 있는 사전 표면형들. list[str] (없으면 빈 목록)."""
    if word in index["lexicon_surface"]:
        return []                          # 사전에 있는 말이다. 오타가 아니다
    if word in index["protected_words"]:
        return []                          # 진짜 한국어이거나 향 전문 용어다
    if len(word) < TYPO_MIN_LEN:
        return []                          # 1글자는 후보가 너무 많다
    jamo = _to_jamo(word)
    return sorted({form for form, target in index["typo_targets"].items()
                   if _jamo_distance_at_most(jamo, target) == TYPO_MAX_DISTANCE})


def typo_gate(index, structured):
    """⑤단계 앞 검문소. (고친 structured, 판정, 교정 목록).

    index      : dict          load_index() 결과
    structured : dict | None   ①단계 구조화 결과

    판정 셋
        "그대로"   고칠 것이 없다. 지금까지와 똑같이 ⑤단계로 간다
        "교정"     오타를 고쳤다. 부른 쪽이 `understand()` 를 다시 돌린다
        "모호"     후보가 여럿이라 무엇으로 고칠지 모른다. **빈 결과를 낸다**

    **사전이 조건을 하나도 못 뽑았을 때만 부른다.** 조건이 하나라도 잡혔으면 그 문장은
    이해된 것이고, 굳이 사용자가 쓴 낱말을 바꿀 이유가 없다.

    **왜 필요한가** — ⑤단계 LLM 은 그럴듯한 한국어 오타를 "모르는 단어" 로 보고 해석하려
    든다. `빨레`(빨래의 오타)를 *"바퀴/롤러로 비유되는 고무·플라스틱 계열"* 로 설명하고
    `rubber`·`plastic` 을 골랐다 [측정 2026-09-18 · 기록 25번]. 사용자는 정상적으로
    요청했는데 **근거까지 지어낸 엉뚱한 결과**를 받는다.

    **무엇을 못 하는가** — 오타의 결과가 진짜 한국어면 못 잡는다. `빨레` 자체가 국어
    사전에 등재된 낱말이라 이 검문소도 `빨레` 를 통과시킨다. 생성 오타 3,775개 기준으로
    포착 93.0% · 놓침 4.6% 다 [측정 기록 30번]. **놓쳤을 때의 동작은 지금과 같다.**
    """
    if not structured or index.get("protected_words") is None:
        return structured, "그대로", []

    fixed = dict(structured)
    corrections = []
    requirements = list(structured.get("additional_requirements") or [])
    out = []
    for expression in requirements:
        text = str(expression)
        for word in _HANGUL_WORD.findall(text):
            candidates = _typo_candidates(index, word)
            if len(candidates) > 1:
                # **고르지 않는다.** 둘 중 하나를 찍으면 절반은 틀린다.
                return structured, "모호", [{"expression": text, "word": word,
                                             "candidates": candidates}]
            if len(candidates) == 1:
                corrections.append({"expression": text, "word": word,
                                    "corrected": candidates[0]})
                text = text.replace(word, candidates[0])
        out.append(text)

    if not corrections:
        return structured, "그대로", []
    fixed["additional_requirements"] = out
    return fixed, "교정", corrections


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

    # ⑤단계 앞 검문소. **조건이 하나도 안 잡혔을 때만** 돈다.
    # 교정하면 사전 경로를 다시 태우고, 모호하면 ⑤단계를 건너뛴다(빈 결과).
    corrections, typo_verdict = [], "그대로"
    if not understood["core"] and understood["unmatched"]:
        fixed, typo_verdict, corrections = typo_gate(index, structured)
        if typo_verdict == "교정":
            understood = understand(index, text, fixed)
        elif typo_verdict == "모호":
            estimator = None       # 지어내지 않는다. 조건 0개 -> NO_CONDITION

    estimate = {}
    if estimator and not understood["core"] and understood["unmatched"]:
        estimate = _apply_estimates(index, understood, estimator, text)
        if estimate:
            # 추정이 조건을 만들었으므로 source 를 다시 적는다. understand() 가 계산한
            # 값은 추정 전 기준이라 그대로 두면 기여를 빠뜨린다.
            understood["source"] = "llm+lexicon"
    found = search(index, understood["core"], understood["avoid"], top_k=top_k,
                   structured=structured)

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
        # 검문소가 한 일. **응답으로 나가지 않는다** — server.py 가 파일 로그에만 남긴다.
        # 교정에 성공하면 그 표현은 미매칭이 아니게 되어 미매칭 로그에 안 남는다.
        # 여기가 없으면 배포 뒤에 검문소가 무엇을 고쳤는지 볼 방법이 없다.
        "typo_verdict": typo_verdict,
        "typo_corrections": corrections,
        "diagnostics": {
            "stage": found["stage"],
            "candidate_count": found["candidate_count"],
            "tie_at_last": found["tie_at_last"],
            "relaxed": found["relaxed"],
            "unmatched_hint": _unmatched_hint(status),
        },
    }


def _apply_estimates(index, understood, estimator, raw_text):
    """사전이 못 받은 표현을 추정해 조건에 넣는다. dict[key, dict].

    raw_text : str   사용자 원문. 표현을 읽을 맥락으로 함께 보낸다

    등급은 `LLM` 이고 **`rationale` 은 비운다.** 사전의 `rationale` 은 사람이 판단한 뒤
    쓴 근거이고 LLM 이 붙인 설명은 사후 해석이다. 한 칸에 섞으면 나중에 구분할 수 없다
    (spec 1장). 추정 설명은 `llm_reasoning` 에 따로 담는다.

    **표현을 묶어 한 번에 묻는다** [측정 기록 37번]. 전에는 표현마다 병렬로 불렀다.
    합성 600 에서 호출이 **175 -> 51회**로 준다(-71%). `evidence` 의 `from` 은 그대로다
    — 표현별로 답을 받으므로 응답 계약이 안 바뀐다.
    """
    items = understood["unmatched"]
    if not items:
        return {}

    expressions = [it["expression"] for it in items]
    guesses = estimator(raw_text, expressions)
    if guesses is None:
        # 호출 자체가 실패했다. 다시 물어도 같은 이유로 실패하므로 그냥 못 푼 것으로 둔다.
        return {}
    guesses = list(guesses)

    # **모델이 조각을 조용히 빠뜨리는 일이 있다** [측정 기록 36번 추기 · 55건 중 1건].
    # 그 자리만 하나씩 다시 묻는다. 한 번만 다시 묻고 그래도 없으면 못 푼 것으로 둔다 —
    # 여기서 되풀이하면 실패한 문장 하나가 호출을 끝없이 늘린다.
    for i, guess in enumerate(guesses):
        if guess is not None:
            continue
        retry = estimator(raw_text, [expressions[i]])
        if retry:
            guesses[i] = retry[0]

    estimate, core = {}, set(understood["core"])
    for item, guess in zip(items, guesses):
        # **`None` 은 호출 실패이고 `{"accords": []}` 는 "향이 아니다" 라는 판정이다.**
        # 둘을 섞으면 네트워크가 한 번 끊긴 표현이 영영 "향이 아님" 으로 굳는다.
        # 실패는 기록하지 않는다 — 다음 요청에서 다시 묻는다.
        if guess is None:
            continue
        accords = [a for a in (guess.get("accords") or []) if a in index["aidx"]]
        # 빈 판정도 기록한다. 그래야 `unmatched_log` 가 캐시로 살려내고
        # 재시작 뒤에도 같은 답이 된다 (전체 표현의 38% 가 여기 해당한다).
        estimate[item["normalized_key"]] = {"accords": accords,
                                            "reasoning": guess.get("reasoning")}
        if not accords:
            continue
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
