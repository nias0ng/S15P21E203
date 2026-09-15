"""①단계 LLM 구조화 — 한국어 문장을 향 조건 dict 로 바꾼다.

`nlr_engine.recommend(index, text, structured)` 의 `structured` 를 채우는 모듈이다.

    import llm_stage1, nlr_engine

    structured = llm_stage1.structure("빨래 냄새 나는 향수 찾고 있어")
    out = nlr_engine.recommend(index, text, structured)

**네트워크를 아는 유일한 파일이다.** 엔진과 사전과 미매칭 로그는 이 파일을 모른다.
그래야 DB 도 인터넷도 없이 `python nlr_engine.py "빨래"` 로 검증할 수 있고,
여기가 죽어도 사전 매칭으로 서비스가 돈다.

왜 필요한가 — 실측 (합성 평가셋 600문장, 사전 v1.8)
---------------------------------------------------
    구조화 없이 사전만    453/600 = 75.5%   <- 지금까지의 서버
    구조화 + 사전         520/600 = 86.7%

LLM 은 **뽑기만 한다. 해석은 사전이 한다.** 프롬프트가 *"이미지·감각 표현(깨끗한·포근한·
차가운)을 임의의 향으로 바꾸지 마세요"* 로 그 경계를 긋고 있다. 이 제약을 풀면 같은 뜻에
다른 accord 가 나오고(측정: 같은 뜻 21쌍 중 15쌍이 상위 50개에서 0% 겹침) 추천 이유를
설명할 수 없게 된다. `spec.md` 1장.

실패하면 `None` 을 돌려준다. **예외를 올리지 않는다** — 부른 쪽은 그대로 사전 매칭으로
내려가면 된다. 요청을 500 으로 죽이지 않는다.

환경변수
--------
    GMS_API_KEY    필수. **없으면 구조화를 건너뛴다**(지금까지의 동작 유지).
                   기본값을 코드에 두지 않는다
    GMS_MODEL      기본 gpt-5.4-nano
    GMS_ENDPOINT   기본 SSAFY GMS 게이트웨이

키가 만료되면 HTTP 401 로 `[GMS 에러] Invalid or expired GMS key` 가 온다.
**재시도로 풀리지 않는다.** 포털에서 재발급받아야 한다.

의존성: 표준 라이브러리만. `requests`·`httpx` 를 새로 넣지 않는다 — 실측도 세션 재사용
없이 매 호출 새 연결로 잰 값이라 조건이 같다.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import pathlib
import re
import urllib.error
import urllib.request

LOGGER = logging.getLogger(__name__)

DEFAULT_ENDPOINT = "https://gms.ssafy.io/gmsapi/api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-5.4-nano"

# [측정] 호출 958회(Golden Set 203 · 합성 600 · 설문 155)의 1회 호출 소요 시간
#   중앙 1.53초 · p90 2.00 · p95 2.20 · p99 3.17 · 최대 7.15
# 5초로 자르면 958회 중 1회(0.10%)가 잘리고, 잘려도 사전 매칭으로 내려갈 뿐이다.
# 백엔드 타임아웃 8초(nlr_api_contract.md) 안에 검색 4ms 와 함께 들어간다.
#
# ⚠ 미매칭 추정(⑤단계)이 붙으면 한 요청에서 LLM 을 2회 부르게 된다. 그때는 5+5=10초라
#    8초를 넘는다. **두 호출이 예산을 나눠 쓰는 구조로 바꿔야 한다.**
DEFAULT_TIMEOUT = 5.0

PROMPT_PATH = pathlib.Path(__file__).resolve().parent / "data" / "stage1_prompt_v1.txt"

# 프롬프트가 요구하는 출력 형태. 엔진의 `structured` 가 이것과 같은 모양이라 변환이 없다.
EMPTY_STAGE1 = {
    "scent_preference": [],
    "context": {"season": [], "daypart": [], "gender": []},
    "performance": {"intensity": "", "longevity": ""},
    "avoid": [],
    "additional_requirements": [],
}
_CODE_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.IGNORECASE | re.DOTALL)
_prompt_cache = {}


class Stage1Error(ValueError):
    """구조화 실패. `code` 로 원인을 구분한다."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


# ---------------------------------------------------------------------------
# 프롬프트 — 파일에서 읽고 지문을 남긴다
# ---------------------------------------------------------------------------
def load_prompt(path=PROMPT_PATH):
    """프롬프트를 파일에서 읽는다. str. 한 번 읽고 캐시한다.

    path : str | Path   기본 data/stage1_prompt_v1.txt

    **코드에 문자열로 박아두지 않는다.** 프롬프트가 바뀌었는데 결과가 왜 바뀌었는지
    모르게 되는 것을 막으려고 파일로 두고 sha256 을 기동 로그에 남긴다.
    """
    path = pathlib.Path(path)
    key = str(path)
    if key not in _prompt_cache:
        text = path.read_text(encoding="utf-8")
        _prompt_cache[key] = text
        LOGGER.info("stage1 프롬프트 적재 %s sha256=%s",
                    path.name, hashlib.sha256(text.encode("utf-8")).hexdigest()[:16])
    return _prompt_cache[key]


def status(path=PROMPT_PATH):
    """구조화를 쓸 수 있는 상태인지 본다. dict.

    **키를 돌려주지 않는다.** 있는지 없는지만 본다.
    """
    try:
        fingerprint = hashlib.sha256(load_prompt(path).encode("utf-8")).hexdigest()[:16]
    except OSError:
        fingerprint = None
    return {
        "enabled": bool(os.environ.get("GMS_API_KEY")) and fingerprint is not None,
        "model": os.environ.get("GMS_MODEL", DEFAULT_MODEL),
        "prompt_sha256": fingerprint,
    }


def build_user_prompt(text):
    """사용자 문장을 감싼다. str. 측정에 쓴 문구 그대로다."""
    return f"아래 사용자 향수 추천 요청을 Stage 1 Schema로 구조화하세요.\n\n사용자 요청:\n{text}"


# ---------------------------------------------------------------------------
# 응답 해석 — 네트워크를 타지 않으므로 따로 검증할 수 있다
# ---------------------------------------------------------------------------
def parse_content(raw_content):
    """모델이 쓴 본문에서 JSON object 를 꺼낸다. dict.

    Markdown 코드펜스를 쓰지 말라고 프롬프트에 적었지만 붙여 오는 경우가 있어 벗겨낸다.
    """
    if not isinstance(raw_content, str) or not raw_content.strip():
        raise Stage1Error("EMPTY_CONTENT", "message.content 가 비었거나 문자열이 아니다")
    match = _CODE_FENCE.match(raw_content)
    cleaned = match.group(1).strip() if match else raw_content.strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise Stage1Error("JSON_PARSE_ERROR", str(exc)) from exc
    if not isinstance(parsed, dict):
        raise Stage1Error("JSON_PARSE_ERROR", "최상위 JSON 이 object 가 아니다")
    return parsed


def validate(value):
    """엔진이 쓰는 필드가 쓸 수 있는 모양인지 본다. dict. 아니면 Stage1Error.

    **엔진이 읽지 않는 필드 때문에 응답 전체를 버리지 않는다.**

    `nlr_engine.understand()` 가 실제로 읽는 것은 아래 셋뿐이다. `context` 와
    `performance` 는 아무도 읽지 않는다 — 계절 데이터가 0건이라(`spec.md` §6 제약 1)
    아직 검색에 못 쓴다.

        scent_preference         accord 이름 후보
        avoid                    회피 대상
        additional_requirements  사전이 해석할 원문 조각. 여기가 커버리지의 핵심이다

    그래서 이 셋만 막고 나머지는 **기록만 한다.** 실측에서 모델이 `performance.sillage`
    처럼 없는 칸을 만들어 온 것이 600건 중 1건 있었는데, 그 응답의
    `additional_requirements` 3개는 멀쩡했다. 그것 때문에 문장을 통째로 버리면
    쓸 수 있는 조건을 잃는다. 86.7% 를 잰 실행(노트북 34)도 이 응답을 받아들였다.

    모르는 칸은 프롬프트가 흔들린다는 신호라 **경고로 남긴다.** 버리는 것과 모르는 것은
    다르다. 목록 밖 accord 이름은 엔진이 `aidx` 대조로 걸러낸다(`spec.md` §5.2).
    """
    if not isinstance(value, dict):
        raise Stage1Error("SCHEMA_VALIDATION_ERROR", "최상위가 object 가 아니다")

    used = ("scent_preference", "avoid", "additional_requirements")
    missing = [field for field in used if field not in value]
    if missing:
        raise Stage1Error("MISSING_KEY", f"엔진이 쓰는 key 가 없다: {missing}")
    for field in used:
        _check_string_list(value[field], field)

    unknown = sorted(set(value) - set(EMPTY_STAGE1))
    if unknown:
        LOGGER.warning("①단계 출력에 모르는 key 가 있다(무시한다): %s", unknown)
    for parent, allowed in (("context", {"season", "daypart", "gender"}),
                            ("performance", {"intensity", "longevity"})):
        nested = value.get(parent)
        if isinstance(nested, dict):
            surplus = sorted(set(nested) - allowed)
            if surplus:
                LOGGER.warning("①단계 출력 %s 에 모르는 key 가 있다(무시한다): %s",
                               parent, surplus)
    return value


def _check_string_list(value, path):
    """문자열 list 인지 본다. None. 아니면 Stage1Error."""
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise Stage1Error("SCHEMA_VALIDATION_ERROR", f"{path} 는 문자열 list 여야 한다")


# ---------------------------------------------------------------------------
# 호출
# ---------------------------------------------------------------------------
def _post_json(url, payload, api_key, timeout):
    """JSON 을 POST 하고 응답 본문을 돌려준다. dict.

    표준 라이브러리만 쓴다. **인증 헤더는 로그에 남기지 않는다.**
    """
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", errors="replace")
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise Stage1Error("JSON_PARSE_ERROR", f"응답이 JSON 이 아니다: {body[:200]}") from exc


def structure(text, *, timeout=DEFAULT_TIMEOUT, prompt_path=PROMPT_PATH, post=None):
    """문장 하나를 향 조건 dict 로 바꾼다. dict 또는 None.

    text        : str                사용자 원문
    timeout     : float              1회 호출 상한. 기본 5초 (실측 근거는 위 상수)
    prompt_path : str | Path         프롬프트 파일
    post        : callable | None    (url, payload, api_key, timeout) -> dict.
                                     네트워크를 대신할 함수. 검증 스크립트가 쓴다

    **실패하면 None 이다.** 키가 없을 때, 호출이 실패할 때, 응답이 스키마에 안 맞을 때
    전부 None 이고 원인은 로그로 남는다. 재시도하지 않는다 — 백엔드 예산 8초 안에서
    5초짜리 호출을 두 번 할 수 없다. 실측상 재시도로 살아난 호출은 958회 중 3회(0.3%)다.
    """
    api_key = os.environ.get("GMS_API_KEY")
    if not api_key:
        LOGGER.warning("GMS_API_KEY 가 없어 ①단계 구조화를 건너뛴다. 사전 매칭만 쓴다")
        return None

    payload = {
        "model": os.environ.get("GMS_MODEL", DEFAULT_MODEL),
        "messages": [
            {"role": "developer", "content": load_prompt(prompt_path)},
            {"role": "user", "content": build_user_prompt(text)},
        ],
    }
    endpoint = os.environ.get("GMS_ENDPOINT", DEFAULT_ENDPOINT)
    send = post or _post_json

    try:
        response = send(endpoint, payload, api_key, timeout)
        return validate(parse_content(response["choices"][0]["message"]["content"]))
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            LOGGER.error("GMS 인증 실패(401). 키가 만료됐을 수 있다. 재시도로 풀리지 않는다")
        else:
            LOGGER.error("GMS HTTP %s. ①단계를 건너뛰고 사전 매칭으로 간다", exc.code)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        LOGGER.error("GMS 호출 실패 %s: %s", type(exc).__name__, exc)
    except Stage1Error as exc:
        LOGGER.error("①단계 출력이 스키마에 안 맞는다 %s: %s", exc.code, exc)
    except (KeyError, IndexError, TypeError) as exc:
        LOGGER.error("GMS 응답에 choices[0].message.content 가 없다: %s", exc)
    return None
