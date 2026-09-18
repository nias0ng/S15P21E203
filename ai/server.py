"""자연어 향수 추천 HTTP 서버.

Spring 이 호출하는 내부 API 다. **외부에 열지 않는다** — 호출량 제한과 인증은 Spring 이 한다.

    uvicorn server:app --host 0.0.0.0 --port 8000

엔드포인트가 둘인 이유
----------------------
    POST /nlr/understand   문장 -> 향 조건만
    POST /nlr/recommend    문장 -> 향수 5개까지

향수 13만 개를 DB 에 넣을지가 아직 안 정해졌다(연동 협의 안건 1). 어느 쪽으로 가든
`/nlr/understand` 는 그대로 쓴다 — 한국어를 향 조건으로 바꾸는 일은 Python 이 계속 맡는다.
`/nlr/recommend` 는 AI 가 검색까지 하는 경로다. DB 에 향수가 채워지면 Spring 이 SQL 로
같은 일을 할 수도 있고, 그때는 이 엔드포인트를 안 쓰게 된다.

①단계 LLM 구조화
----------------
`conditions` 가 요청에 없으면 **이 서버가 직접 LLM 을 부른다**(`llm_stage1.py`).
백엔드가 이미 넘겼으면 그대로 쓴다 — **요청 형식은 바뀌지 않는다.**

    있음 -> 그대로 쓴다          Spring 이 스스로 구조화하게 되어도 이 파일은 안 바뀐다
    없음 -> llm_stage1.structure()   실패하면 None 이라 사전 매칭으로 내려간다

`GMS_API_KEY` 가 없으면 구조화를 건너뛰고 **서버는 그대로 뜬다.** 사전 매칭만으로도
합성 600문장의 76.8% 는 조건을 뽑는다(사전 v1.15). 키가 있으면 88.8% 다.

이번 범위가 아닌 것
------------------
**미매칭 추정(⑤단계)이 없다.** 붙는 자리는 `nlr_engine.recommend(..., estimator=)` 다.

**추천 이유 문장화가 없다.** `matched[].rationale` 이 재료다.

의존성: fastapi, uvicorn, pandas, numpy.
"""
from __future__ import annotations

import contextlib
import logging
import os
import pathlib

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

import llm_stage1
import nlr_engine
import unmatched_log

LOGGER = logging.getLogger(__name__)

# 입력 상한. unmatched_log.MAX_RAW_CHARS 와 같은 값이어야 원문이 잘리지 않는다.
MAX_TEXT_CHARS = unmatched_log.MAX_RAW_CHARS

# FastAPI 가 직접 내는 에러를 백엔드 공통 형식의 code 로 옮긴다.
_HTTP_ERROR_CODES = {400: "NLR_INVALID_REQUEST",
                     404: "NLR_NOT_FOUND",
                     405: "NLR_METHOD_NOT_ALLOWED"}

# 본문 디코딩 실패 때 FastAPI 가 넣는 문구다(`fastapi/routing.py`). 이것만 한국어로 바꾼다.
_BODY_PARSE_DETAIL = "There was an error parsing the body"
_BODY_PARSE_MESSAGE = "요청 본문을 읽지 못했습니다. UTF-8 로 인코딩했는지 확인하십시오."

# 환경마다 다를 수 있는 값은 환경변수로 받는다. 컨테이너에서는 볼륨 경로를 넣는다.
LOG_PATH = pathlib.Path(os.environ.get("NLR_LOG_PATH", unmatched_log.DEFAULT_LOG))

# ⑤단계 미매칭 추정 스위치. 끄면 이 기능을 얹기 전과 똑같이 돈다.
# 요청마다 GMS 호출이 붙을 수 있어(캐시에 없을 때만) 끌 수 있게 둔다.
ESTIMATOR_ENABLED = os.environ.get("NLR_ESTIMATOR", "on").lower() not in ("0", "off", "false")
LEXICON_PATH = os.environ.get("NLR_LEXICON_PATH") or None
PERFUMES_PATH = os.environ.get("NLR_PERFUMES_PATH") or None


class UnderstandRequest(BaseModel):
    """문장 하나와 (있으면) ①단계 구조화 결과.

    **칸 이름이 `conditions` 가 아니라 `structured` 다.** 응답에도 `conditions` 가
    있는데 그건 ②단계에서 사전이 바꾼 accord 라 **모양이 다르다.** 이름이 같으면
    응답의 것을 요청에 되돌려 넣게 되고, 그러면 에러 없이 조건 0개가 된다.
    이름을 다르게 두어 그 실수 자체를 없앤다.
    """

    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    structured: dict | None = None


class RecommendRequest(UnderstandRequest):
    """위와 같고 몇 개까지 받을지만 더한다."""

    topK: int = Field(default=nlr_engine.TOP_K, ge=1, le=20)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """기동 시 한 번만 적재한다.

    13만 x 92 행렬(약 48MB)을 만들므로 요청마다 부르면 안 된다. 적재는 1초 안팎이고
    추천 한 번은 4ms 다. 적재에 실패하면 기동을 중단한다 — 반쯤 뜬 서버가 더 나쁘다.

    **LLM 구조화는 실패해도 기동을 막지 않는다.** 키가 없으면 사전 매칭으로 돈다.
    어느 쪽인지 로그로 남긴다 — 배포된 서버가 76.8% 로 도는지 88.8% 로 도는지는
    응답만 봐서는 알 수 없다.
    """
    logging.basicConfig(level=logging.INFO)   # 이미 설정돼 있으면 아무 일도 하지 않는다
    app.state.index = nlr_engine.load_index(perfumes_csv=PERFUMES_PATH,
                                            lexicon_csv=LEXICON_PATH)
    llm = llm_stage1.status()
    LOGGER.info("①단계 LLM 구조화 %s (model=%s prompt=%s)",
                "켜짐" if llm["enabled"] else "꺼짐 — GMS_API_KEY 가 없다",
                llm["model"], llm["prompt_sha256"])

    # ⑤단계 미매칭 추정. **조건이 하나도 안 잡혔을 때만** 돈다.
    # `cached_estimator` 가 미매칭 로그를 캐시로 쓴다 — 같은 표현은 항상 같은 답이고
    # 재시작해도 파일에서 다시 채운다. 캐시가 없으면 같은 문장에 매번 다른 향수가
    # 나온다 [측정 2026-09-17 · 같은 설정으로 두 번 불러 5문장 중 5문장이 달랐다].
    if ESTIMATOR_ENABLED and llm["enabled"]:
        app.state.estimator = unmatched_log.cached_estimator(
            llm_stage1.make_estimator(app.state.index), path=LOG_PATH)
        LOGGER.info("⑤단계 미매칭 추정 켜짐 — 캐시 %d개를 %s 에서 읽었다",
                    len(app.state.estimator.cache), LOG_PATH)
    else:
        app.state.estimator = None
        LOGGER.info("⑤단계 미매칭 추정 꺼짐 (NLR_ESTIMATOR=%s · GMS 키 %s)",
                    os.environ.get("NLR_ESTIMATOR", "on"),
                    "있음" if llm["enabled"] else "없음")
    yield
    app.state.index = None
    app.state.estimator = None


app = FastAPI(title="향해 자연어 추천", lifespan=lifespan)


def _error(status, code, message):
    """백엔드 공통 형식으로 에러를 낸다. JSONResponse.

    `global/response/ApiErrorResponse.java` 가 {code, message} 이므로 맞춘다.
    FastAPI 기본값은 {"detail": ...} 이라 그대로 두면 Spring 쪽 파싱이 갈린다.
    """
    return JSONResponse(status_code=status, content={"code": code, "message": message})


@app.exception_handler(RequestValidationError)
async def _on_validation_error(request: Request, exc: RequestValidationError):
    """입력이 형식에 안 맞으면 400 으로 낸다. JSONResponse. FastAPI 기본은 422 다.

    **어느 칸이 틀렸는지 적는다.** 예전에는 무엇이 틀렸든 "text 는 1~500자여야 합니다"
    가 나가서, JSON 문법이 깨진 요청에도 길이 문제처럼 보였다.

    **값은 싣지 않는다.** 사용자가 쓴 원문이 들어올 수 있고 에러 응답은 그대로 로그에
    남는다. 칸 이름과 사유만 적는다.
    """
    errors = exc.errors()
    if any(error.get("type") == "json_invalid" for error in errors):
        # loc 에 칸 이름이 아니라 깨진 위치(정수)가 들어온다. 칸 이름처럼 적으면 헷갈린다.
        return _error(400, "NLR_INVALID_REQUEST", "JSON 형식이 올바르지 않습니다.")

    fields = sorted({".".join(part for part in error.get("loc", ())
                              if isinstance(part, str) and part != "body")
                     for error in errors} - {""})
    where = f" ({', '.join(fields)})" if fields else ""
    hint = f" text 는 1~{MAX_TEXT_CHARS}자여야 합니다." if "text" in fields else ""
    return _error(400, "NLR_INVALID_REQUEST",
                  f"요청 형식이 올바르지 않습니다{where}.{hint}")


@app.exception_handler(StarletteHTTPException)
async def _on_http_exception(request: Request, exc: StarletteHTTPException):
    """FastAPI 가 직접 내는 에러도 공통 형식으로 바꾼다. JSONResponse.

    **본문을 디코딩하지 못하면 여기로 온다.** FastAPI 는 본문 파싱이 JSONDecodeError
    가 아닌 이유로 실패하면 `HTTPException(400, "There was an error parsing the body")`
    를 던지고(`fastapi/routing.py`), Starlette 기본 핸들러가 `{"detail": ...}` 로 낸다.
    핸들러가 라우트보다 앞이라 `RequestValidationError` 로는 안 걸린다.

    실제로 걸리는 경우 — Windows 셸이 인자의 한글을 깨뜨려 UTF-8 이 아닌 바이트가
    도착할 때다(`README.md`). Spring 은 정상 UTF-8 을 보내므로 운영 위험은 낮지만,
    계약서가 "에러는 전부 공통 형식" 이라고 적어 둔 것과 어긋나 있었다.

    FastAPI 의 영어 문구만 한국어로 바꾸고 나머지 `detail` 은 그대로 싣는다.
    문구가 바뀌어도 형식은 공통 형식으로 유지된다.
    """
    message = (_BODY_PARSE_MESSAGE if exc.detail == _BODY_PARSE_DETAIL
               else str(exc.detail))
    return _error(exc.status_code,
                  _HTTP_ERROR_CODES.get(exc.status_code, "NLR_ERROR"), message)


def _camel_evidence(evidence):
    """엔진의 근거를 백엔드가 읽을 형태로. list[dict]."""
    return [{
        "accord": e["accord"],
        "from": e.get("from"),
        "tier": e.get("tier"),
        "entryId": e.get("entry_id"),
        "rationale": e.get("rationale"),
        "llmReasoning": e.get("llm_reasoning"),
    } for e in evidence]


def _camel_unmatched(unmatched):
    """미매칭 표현을 백엔드가 읽을 형태로. list[dict]."""
    return [{
        "expression": u["expression"],
        "normalizedKey": u["normalized_key"],
        "unmatchReason": u["unmatch_reason"],
        "entryId": u.get("entry_id"),
    } for u in unmatched]


def _structure(body):
    """요청에 `structured` 가 없으면 ①단계 LLM 구조화로 채운다. dict 또는 None.

    **백엔드가 이미 넘겼으면 부르지 않는다.** Spring 이 스스로 구조화하기로 바뀌어도
    이 조건만으로 호출이 사라진다.

    빈 dict(`{}`)도 없는 것으로 본다. 엔진에 넘겨도 기여하는 바가 없어서다.
    LLM 호출이 실패하면 None 이고, 엔진은 사전 문자열 매칭으로 내려간다.

    **넘어온 값이 ①단계 모양인지 검사한다.** 엔진이 읽는 세 칸이 없으면 400 을 낸다.
    이걸 안 하면 응답의 `conditions`(②단계 결과)를 되돌려 넣었을 때 **에러 없이
    조건 0개**가 나오고, 원문에 사전 표현이 있으면 우연히 성공하기도 해서 재현이
    어렵다. 조용히 틀리는 것보다 시끄럽게 틀리는 편이 낫다.
    """
    if not body.structured:
        return llm_stage1.structure(body.text)
    try:
        return llm_stage1.validate(body.structured)
    except llm_stage1.Stage1Error as exc:
        raise StarletteHTTPException(
            status_code=400,
            detail=f"structured 가 ①단계 구조화 결과가 아닙니다 ({exc.code}). "
                   f"응답의 conditions 를 그대로 넣지 마십시오 — "
                   f"넘길 값은 /nlr/understand 응답의 structured 입니다.") from exc


def _record_unmatched(result):
    """미매칭 표현을 로그에 남긴다. None.

    **로그 실패가 요청을 죽이지 않게 감싼다.** 미매칭 로그는 사전을 키우는 재료이지
    응답을 만드는 데 필요한 것이 아니다. 감싸지 않으면 로그를 못 쓰는 순간
    **미매칭 표현이 있는 요청마다 500 이 난다** — 쓸 수 없는 경로를 주고 확인했다.

    컨테이너에서 실제로 생기는 조건이다. 볼륨 소유자가 컨테이너 사용자와 안 맞으면
    쓰기가 막힌다(`Dockerfile` 의 `/app/logs` 주석).

    **예외를 삼키지 않는다.** 원인을 `ERROR` 로 남긴다. 파일에 못 쓴 사실을 파일에
    남길 수는 없으니 표준 로그로 간다.

    잡는 것은 `OSError` 뿐이다 — 권한·경로·디스크처럼 **환경이 만드는 실패**다.
    그 밖의 예외는 코드의 버그이므로 그대로 올라가게 둔다.
    """
    try:
        unmatched_log.record(result, path=LOG_PATH)
    except OSError as exc:
        LOGGER.error("미매칭 로그를 쓰지 못했다. 추천은 그대로 돌려준다 — %s: %s (경로 %s)",
                     type(exc).__name__, exc, LOG_PATH)


def _camel_conditions(understood):
    """사전이 바꿔 낸 향 조건. dict. **이건 검색 결과지 요청에 넣는 값이 아니다.**

    `/nlr/recommend` 요청의 `conditions` 와 **이름만 같고 다른 것이다.**

        요청의 conditions   ①단계 LLM 이 뽑은 '말'   scent_preference · additional_requirements
        이 함수의 결과      ②단계 사전이 바꾼 accord  core · matchedExpressions

    이걸 `/nlr/recommend` 의 `conditions` 에 넣으면 **에러 없이 조건 0개가 된다** —
    엔진이 모르는 key 라 읽지 않는다. 다시 넘길 값은 응답의 `structured` 다.
    """
    return {
        "core": understood["core"],
        "avoid": understood["avoid"],
        "matchedExpressions": understood["matched_expressions"],
        "source": understood["source"],
    }


@app.get("/health")
def health(request: Request):
    """적재가 끝났는지 본다. dict.

    Jenkins 헬스체크가 이걸 본다. 적재 전에는 기동이 안 끝나므로 응답하지 않는다.
    """
    index = getattr(request.app.state, "index", None)
    if index is None:
        return _error(503, "NLR_NOT_READY", "데이터를 아직 적재하지 못했습니다.")
    return {"status": "ok", "perfumes": index["n_perfumes"], "accords": len(index["accords"]),
            "llm": llm_stage1.status()["enabled"]}


@app.post("/nlr/understand")
def understand(body: UnderstandRequest, request: Request):
    """문장에서 향 조건만 뽑는다. dict.

    향수를 찾지 않는다. DB 에 향수가 채워져 Spring 이 SQL 로 검색하게 되어도
    이 엔드포인트는 그대로 쓴다.

    **이어서 `/nlr/recommend` 를 부를 거면 응답의 `structured` 를 그 요청의
    `conditions` 에 그대로 넣으십시오.** 그러면 LLM 을 한 번만 부른다. 다시 부르면
    같은 문장이라도 다른 조건이 나올 수 있어(실측: 15문장 중 6문장) 화면에 띄운
    해석과 결과가 어긋난다.
    """
    index = request.app.state.index
    structured = _structure(body)
    understood = nlr_engine.understand(index, body.text, structured)
    result = {
        "query": body.text,
        "conditions": _camel_conditions(understood),
        "structured": structured,
        "evidence": _camel_evidence(understood["evidence"]),
        "unmatched": _camel_unmatched(understood["unmatched"]),
    }
    _record_unmatched({"query": body.text,
                       "unmatched": understood["unmatched"],
                       "conditions": {"core": understood["core"]}})
    return result


@app.post("/nlr/recommend")
def recommend(body: RecommendRequest, request: Request):
    """문장 하나로 향수를 찾는다. dict.

    `status` 네 가지를 화면에서 구분해야 한다. 특히 `NO_CONDITION` 일 때
    **인기 향수를 대신 보여주면 안 된다** — 추천처럼 보이지만 근거가 없다.
    """
    index = request.app.state.index
    out = nlr_engine.recommend(index, body.text, _structure(body), top_k=body.topK,
                               estimator=request.app.state.estimator)
    _record_unmatched(out)
    return {
        "status": out["status"],
        "query": out["query"],
        "conditions": _camel_conditions(out["conditions"]),
        "results": [{
            "fragranticaId": r["perfume_id"],
            "name": r["name"],
            "brand": r["brand"],
            "people": r["people"],
            "rating": r["rating"],
            "score": r["score"],
            "matched": [{
                "accord": m["accord"],
                "strength": m["strength"],
                "from": m["from"],
                "tier": m["tier"],
                "rationale": m["rationale"],
            } for m in r["matched"]],
        } for r in out["results"]],
        "unmatched": _camel_unmatched(out["unmatched"]),
        "diagnostics": {
            "stage": out["diagnostics"]["stage"],
            "candidateCount": out["diagnostics"]["candidate_count"],
            "tieAtLast": out["diagnostics"]["tie_at_last"],
            "relaxed": out["diagnostics"]["relaxed"],
            "unmatchedHint": out["diagnostics"]["unmatched_hint"],
        },
    }
