"""미매칭 로그 — 사전이 받지 못한 한국어 표현을 기록한다.

지금은 사전이 표현을 못 받으면 그 사실이 사라진다. 합성 평가셋 600건의 22.3%,
실사용자 설문 155건의 44% 가 향 조건을 하나도 못 뽑는데 그 내용이 남지 않는다.
이 모듈은 그 실패를 남겨 나중에 사전을 키우는 근거로 쓴다.

지킬 원칙 셋
  1. **사전 경로와 LLM 경로를 등급으로 구분한다.** 사전은 같은 뜻이면 항상 같은 결과를
     내지만 LLM 은 그렇지 않다(측정: 같은 뜻 21쌍 중 15쌍이 상위 50개에서 0% 겹침).
  2. **LLM 이 쓴 "이유" 는 근거가 아니라 추정 기록이다.** 사전의 `rationale` 과
     `llm_reasoning` 을 한 칸에 섞지 않는다.
  3. **승격에 빈도만이 아니라 판정이 들어간다.** 3회 쌓였다는 것은 "자주 나온다"(중요도)
     이지 "그 추정이 맞다"(정확도)가 아니다. 이 모듈은 후보를 올리는 데까지만 한다.

쓰는 법
-------
    import unmatched_log as ulog
    from nlr_engine import load_index, recommend

    index = load_index()
    out = recommend(index, "밤에 쓰기 좋은 섹시한 향")
    ulog.record(out)                       # 미매칭 표현을 한 줄씩 덧붙인다

    for row in ulog.review_queue(top_n=20):  # 자주 나온 순으로 검토 후보
        print(row["normalized_key"], row["occurrence_count"])

LLM 추정을 붙이려면 추정 함수를 만들어 넘긴다. 이 모듈과 엔진은 네트워크를 모른다.

    estimate = ulog.cached_estimator(my_gms_call)   # 같은 원문은 한 번만 부른다
    out = recommend(index, text, estimator=estimate)

저장 형식
---------
한 줄씩 덧붙이기만 한다(append-only). **누적 횟수를 파일에 적지 않는다.** 같은 표현이
어떤 문맥에서 나왔는지가 판정에 필요한데, 카운터만 올리면 그 문맥이 사라지기 때문이다.
횟수·최초·최종 등장은 `review_queue()` 가 읽을 때 센다.

개인정보
--------
`raw_text` 에 사용자 원문이 들어간다. 설문 실측에 건강·신분 서술이 있었다.
  - `MAX_RAW_CHARS` 자까지만 저장한다
  - 로그 디렉터리는 `.gitignore` 에 있다. **저장소에 올라가면 회수할 수 없다**
  - `purge_raw_text()` 로 `RETENTION_DAYS` 가 지난 줄의 원문을 비운다. 표현은 남는다

의존성: 표준 라이브러리만.
"""
from __future__ import annotations

import collections
import datetime as dt
import json
import logging
import pathlib
import re
import unicodedata

LOGGER = logging.getLogger(__name__)

MAX_RAW_CHARS = 500       # 설문 실측 최대가 600자(행운의 편지)였다
RETENTION_DAYS = 30       # 이 기간이 지나면 raw_text 만 비운다

_LOG_DIR = pathlib.Path(__file__).resolve().parent / "logs"
DEFAULT_LOG = _LOG_DIR / "unmatched.jsonl"
# 오타 검문소가 한 일. **미매칭 로그와 파일을 나눈다** — 교정에 성공한 표현은 미매칭이
# 아니게 되어 저 파일에 안 남고, 같은 파일에 섞으면 `review_queue()` 의 집계가 오염된다.
DEFAULT_CORRECTION_LOG = _LOG_DIR / "corrections.jsonl"

# 미매칭 원인 — 셋은 고쳐야 할 곳이 다르다
NOT_IN_LEXICON = "NOT_IN_LEXICON"          # 사전에 없다 -> 항목을 추가한다
CONDITION_NOT_MET = "CONDITION_NOT_MET"    # 있는데 match_condition 이 안 걸렸다 -> 조건을 손본다
NOT_CORE = "NOT_CORE"                      # 있는데 optional/NO_MAPPING 이다 -> 판정 이력이 있다


def normalize_key(expression):
    """조회·집계용 키. str.

    NFC 정규화 + 공백 정리 + 소문자. **형태소 분석은 하지 않는다** —
    spec 2장 2-b 의 Kiwi 정규화가 아직 없어서 `레몬 같은 상큼함` 과 `상큼함` 은
    다른 키가 된다. 형태소 분석이 들어오면 여기를 바꾼다.
    """
    text = unicodedata.normalize("NFC", str(expression)).strip()
    return re.sub(r"\s+", " ", text).lower()


def record(result, path=DEFAULT_LOG, max_raw_chars=MAX_RAW_CHARS, now=None):
    """recommend() 결과의 미매칭 표현을 한 줄씩 덧붙인다. int (쓴 줄 수).

    result         : dict            nlr_engine.recommend() 가 낸 것
    path           : str | Path      기본 ai/logs/unmatched.jsonl
    max_raw_chars  : int             원문을 이 길이까지만 저장한다
    now            : datetime | None 시각. 테스트에서 고정하려고 열어뒀다
    """
    rows = result.get("unmatched") or []
    if not rows:
        return 0

    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    stamp = (now or dt.datetime.now(dt.timezone.utc).astimezone()).isoformat(timespec="seconds")
    raw = str(result.get("query", ""))[:max_raw_chars]
    had_conditions = bool(result.get("conditions", {}).get("core"))
    estimate = result.get("llm_estimate") or {}

    lines = []
    for item in rows:
        key = item["normalized_key"]
        guess = estimate.get(key) or {}
        lines.append(json.dumps({
            "ts": stamp,
            "raw_text": raw,
            "expression": item["expression"],
            "normalized_key": key,
            "unmatch_reason": item["unmatch_reason"],
            "entry_id": item.get("entry_id"),
            "had_conditions": had_conditions,
            "llm_accords": guess.get("accords"),
            "llm_reasoning": guess.get("reasoning"),
            "tier": "LLM" if guess else None,
            "result_count": len(result.get("results") or []) if guess else None,
        }, ensure_ascii=False))

    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(lines) + "\n")
    return len(lines)


def record_corrections(result, path=DEFAULT_CORRECTION_LOG,
                       max_raw_chars=MAX_RAW_CHARS, now=None):
    """오타 검문소가 한 일을 한 줄씩 덧붙인다. int (쓴 줄 수).

    result : dict   nlr_engine.recommend() 가 낸 것. `typo_verdict` 를 읽는다

    **`"그대로"` 는 쓰지 않는다.** 대부분이 그것이라(실측 369개 중 97.8%) 쓰면 파일이
    의미 없이 커진다. 검문소가 실제로 개입한 것만 남긴다.

    **왜 남기나** — 교정에 성공하면 그 표현은 미매칭이 아니게 되어 `record()` 가 안
    남긴다. 이 파일이 없으면 배포 뒤에 *"검문소가 무엇을 고쳤나 · 오교정은 없었나"* 를
    볼 방법이 없다. 검문소를 계속 둘지 판단할 근거가 여기서 나온다.

    개인정보는 `record()` 와 같은 규칙이다 — 원문을 `max_raw_chars` 자까지만 쓰고
    `purge_raw_text()` 가 함께 비운다.
    """
    verdict = result.get("typo_verdict")
    if verdict in (None, "그대로"):
        return 0

    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    stamp = (now or dt.datetime.now(dt.timezone.utc).astimezone()).isoformat(timespec="seconds")
    lines = []
    for item in (result.get("typo_corrections") or []):
        lines.append(json.dumps({
            "ts": stamp,
            "raw_text": str(result.get("query", ""))[:max_raw_chars],
            "verdict": verdict,
            "expression": item.get("expression"),
            "word": item.get("word"),
            # 교정이면 고친 낱말 하나, 모호면 고르지 못한 후보들이다
            "corrected": item.get("corrected"),
            "candidates": item.get("candidates"),
            "result_count": len(result.get("results") or []),
        }, ensure_ascii=False))
    if not lines:
        # **여기 오면 안 된다.** `typo_gate` 는 `"교정"` 이면 최소 1건, `"모호"` 면 정확히
        # 1건을 돌려주고, 빈 목록은 `"그대로"` 뿐인데 그건 위에서 걸렀다.
        # 조용히 넘기면 판정이 소리 없이 사라지므로 남긴다 — 검문소를 계속 둘지
        # 판단할 근거가 이 파일이다.
        LOGGER.warning("검문소 판정이 '%s' 인데 남길 항목이 없다. "
                       "typo_gate 와 이 함수가 어긋났다는 뜻이다", verdict)
        return 0
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(lines) + "\n")
    return len(lines)


def read(path=DEFAULT_LOG):
    """기록을 전부 읽는다. list[dict]. 파일이 없으면 빈 목록."""
    path = pathlib.Path(path)
    if not path.is_file():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue   # 쓰다 만 줄은 건너뛴다. 나머지 기록을 버리지 않는다
    return out


def review_queue(path=DEFAULT_LOG, top_n=30, examples=3):
    """검토 후보를 자주 나온 순으로 낸다. list[dict].

    **문턱을 두지 않는다.** spec 4.4 는 3회 이상을 후보로 적었으나, 실측상
    합성 600건에서 고유 표현 1,630개 중 3회 이상이 37개(2.3%)뿐이라 거의 발화하지 않는다.
    실사용 규모를 모르는 상태에서 절대 문턱은 의미가 없으므로 상대 순위를 쓴다.

    반환 항목 — normalized_key / occurrence_count / first_seen / last_seen /
                reasons(원인별 횟수) / entry_ids / llm_accords / examples(원문 표본)
    """
    rows = read(path)
    if not rows:
        return []

    grouped = collections.defaultdict(list)
    for row in rows:
        grouped[row["normalized_key"]].append(row)

    queue = []
    for key, group in grouped.items():
        stamps = sorted(r["ts"] for r in group)
        samples = [r["raw_text"] for r in group if r.get("raw_text")][:examples]
        guesses = [r["llm_accords"] for r in group if r.get("llm_accords")]
        queue.append({
            "normalized_key": key,
            "occurrence_count": len(group),
            "first_seen": stamps[0],
            "last_seen": stamps[-1],
            "reasons": dict(collections.Counter(r["unmatch_reason"] for r in group)),
            "entry_ids": sorted({r["entry_id"] for r in group if r.get("entry_id")}),
            "llm_accords": guesses[-1] if guesses else None,
            "examples": samples,
        })
    queue.sort(key=lambda r: (-r["occurrence_count"], r["normalized_key"]))
    return queue[:top_n]


def load_estimates(path=DEFAULT_LOG):
    """이미 추정한 표현을 읽는다. dict[str, dict].

    같은 표현에 여러 추정이 있으면 **마지막 것**을 쓴다.
    """
    out = {}
    for row in read(path):
        # **`[]` 와 `null` 을 구분한다.** `[]` 는 "LLM 이 향이 아니라고 답했다" 이고
        # `null` 은 "아직 묻지 않았다" 다. 빈 것도 캐시로 살려야 재시작 뒤에 같은
        # 답이 나오고 같은 표현을 다시 묻지 않는다 (전체의 38%).
        if row.get("llm_accords") is not None:
            out[row["normalized_key"]] = {"accords": row["llm_accords"],
                                          "reasoning": row.get("llm_reasoning")}
    return out


def cached_estimator(estimate):
    """추정 함수를 캐시로 감싼다. callable.

    estimate : callable  (원문, 표현 목록) 을 받아 표현마다 하나씩 담긴 list 를 낸다

    같은 표현을 두 번 물으면 같은 답이 나오게 한다. 측정(노트북 26)상 LLM 은 같은 뜻에
    다른 답을 내므로, 캐시가 없으면 한 요청 안에서도 표현마다 답이 갈린다.

    **이 프로세스 안에서만 캐시한다. 파일을 읽지 않는다.**

    전에는 기동할 때 미매칭 로그를 읽어 캐시를 채웠다. 그러면 **LLM 이 한 번 잘못
    추정한 값이 파일에 남아 영구히 되풀이된다.** 실제로 확인했다 [측정 2026-09-18].

        "빨레 냄새 나는 향수"      <- `빨래` 의 오타
          ⑤단계 추정 -> rubber · plastic   ("빨레 = 고무 같은 재질" 이라고 지어냈다)
          조건 ['plastic','rubber'] -> 1위 Garage
          그 줄이 로그에 남아 프로세스를 다시 띄워도 같은 결과가 나왔다

    LLM 의 일시적 오류가 파일을 거치면서 **시스템의 지속적 규칙**이 된다. 재현성은
    올라가지만 틀린 답의 재현성이다.

    **잃는 것은 작다.** 캐시 키가 ①단계가 뽑은 표현인데 그 표현이 같은 문장에서도
    매번 달라진다 — `additional_requirements` 일치율 **9.2%** [측정 기록 17·23번].
    즉 재시작 뒤에 키가 맞을 확률이 10% 남짓이라 파일로 이어 붙일 실익이 원래 작았다.
    측정 기록 23번도 *"캐시는 한 프로세스 안에서 같은 표현이 두 번 나올 때만 맞는다"*
    로 같은 것을 적었다.

    **기록은 그대로 쌓인다.** `record()`(쓰기)와 이 함수(읽기)는 원래 분리돼 있어서
    읽기만 끊으면 미매칭 표현 기록은 남는다. 사전 확장 근거를 잃지 않는다.

    **⚠ 키는 원문과 표현 목록을 함께 쓴다.** 표현이 달라지면 키가 안 맞는다.
    **같은 요청의 흔들림만 막고 표현 자체의 흔들림은 막지 못한다**
    [측정 2026-09-17 · 측정 기록 21번].

    **표현 단위가 아니라 원문 단위다** [측정 기록 37번]. 묶음 판은 답이 원문에 따라
    달라지므로, 표현 이름만으로 기억하면 **다른 문장에서 나온 답**을 가져다 쓴다.
    그리고 표현 단위로 남겨 두면 캐시에 든 것이 묶음에서 빠져 **같은 문장인데 부를
    때마다 모델이 보는 조각 수가 달라진다.** 잃는 재사용은 작다 — ⑤단계가 도는
    문장 안에서 같은 표현이 두 번 나오는 자리가 **합성 1.0% · 설문 0.8%** 다.

    ⚠ 31번이 적은 `설문 2.6% · 합성 10.1%` 는 **⑤단계가 안 도는 문장까지 센 값**이다
    (재현해 9.9% · 2.5% 로 확인했다). ⑤단계는 조건이 0개인 문장에서만 도는데 그
    문장들의 표현은 거의 안 겹친다.
    """
    cache = {}

    def wrapped(raw_text, expressions):
        key = (normalize_key(raw_text), tuple(expressions))
        if key not in cache:
            guesses = estimate(raw_text, list(expressions))
            # **실패(`None`)를 캐시에 넣지 않는다.** 넣으면 네트워크가 한 번 끊긴
            # 문장이 "향이 아님" 으로 굳어 영영 안 풀린다. 다음 요청에서 다시 묻는다.
            if guesses is None:
                return None
            # **빠진 자리(`None`)가 하나라도 있으면 캐시하지 않는다.** 부른 쪽이 그
            # 자리만 다시 묻고, 그 재호출은 표현 하나짜리 목록이라 키가 달라 따로 캐시된다.
            #
            # **왜 부분 성공을 안 담는가** — 담으면 묶음 호출 1회는 아끼지만 **누락된
            # 자리가 굳어** 그 문장은 올 때마다 재호출을 낸다. 위에서 실패를 안 담는 것과
            # 같은 판단이다(N15 · `빨레` 가 rubber/plastic 으로 굳던 일). 다음에 깨끗한
            # 답을 받을 기회를 남긴다.
            #
            # 잃는 것은 작다 — 서식 오류가 났고(측정 0/55) **그리고** 같은 원문이 같은
            # 표현 목록으로 다시 와야 하는데, ①단계의 `additional_requirements` 일치율이
            # 9.2% 라 목록까지 같을 확률이 낮다 [측정 기록 17·23번]. [MR 리뷰 2026-09-21]
            if any(g is None for g in guesses):
                return list(guesses)
            cache[key] = [{"accords": list(g.get("accords") or []),
                           "reasoning": g.get("reasoning")} for g in guesses]
        return list(cache[key])

    wrapped.cache = cache
    return wrapped


def purge_raw_text(path=DEFAULT_LOG, days=RETENTION_DAYS, now=None):
    """보관 기간이 지난 줄의 raw_text 를 비운다. int (비운 줄 수).

    **줄을 지우지 않는다.** 표현과 원인은 남기고 원문만 비운다. 빈도 집계는 그대로 되고
    개인정보만 사라진다. 되돌릴 수 없으므로 실행 전에 확인한다.
    """
    path = pathlib.Path(path)
    rows = read(path)
    if not rows:
        return 0

    cutoff = (now or dt.datetime.now(dt.timezone.utc).astimezone()) - dt.timedelta(days=days)
    cleared = 0
    for row in rows:
        if not row.get("raw_text"):
            continue
        try:
            stamp = dt.datetime.fromisoformat(row["ts"])
        except ValueError:
            continue
        if stamp < cutoff:
            row["raw_text"] = ""
            cleared += 1

    if cleared:
        body = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows)
        path.write_text(body + "\n", encoding="utf-8", newline="\n")
    return cleared
