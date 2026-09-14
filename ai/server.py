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

이번 범위가 아닌 것
------------------
**LLM 구조화 호출이 없다.** `conditions` 를 요청으로 받기만 한다. 사전 문자열 매칭만 쓰면
합성 평가셋 600건 기준 결과가 나오는 비율이 77.7% -> 35.7% 로 떨어지지만 서비스는 죽지 않는다.
LLM 연결은 다음 스토리다. 붙는 자리는 `nlr_engine.recommend(..., estimator=)` 다.

**추천 이유 문장화가 없다.** `matched[].rationale` 이 재료다.

의존성: fastapi, uvicorn, pandas, numpy.
"""
from __future__ import annotations

import contextlib
import os
import pathlib

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import nlr_engine
import unmatched_log

# 입력 상한. unmatched_log.MAX_RAW_CHARS 와 같은 값이어야 원문이 잘리지 않는다.
MAX_TEXT_CHARS = unmatched_log.MAX_RAW_CHARS

# 환경마다 다를 수 있는 값은 환경변수로 받는다. 컨테이너에서는 볼륨 경로를 넣는다.
LOG_PATH = pathlib.Path(os.environ.get("NLR_LOG_PATH", unmatched_log.DEFAULT_LOG))
LEXICON_PATH = os.environ.get("NLR_LEXICON_PATH") or None
PERFUMES_PATH = os.environ.get("NLR_PERFUMES_PATH") or None


class UnderstandRequest(BaseModel):
    """문장 하나와 (있으면) LLM 구조화 결과."""

    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    conditions: dict | None = None


class RecommendRequest(UnderstandRequest):
    """위와 같고 몇 개까지 받을지만 더한다."""

    topK: int = Field(default=nlr_engine.TOP_K, ge=1, le=20)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """기동 시 한 번만 적재한다.

    13만 x 92 행렬(약 48MB)을 만들므로 요청마다 부르면 안 된다. 적재는 1초 안팎이고
    추천 한 번은 4ms 다. 적재에 실패하면 기동을 중단한다 — 반쯤 뜬 서버가 더 나쁘다.
    """
    app.state.index = nlr_engine.load_index(perfumes_csv=PERFUMES_PATH,
                                            lexicon_csv=LEXICON_PATH)
    yield
    app.state.index = None


app = FastAPI(title="향해 자연어 추천", lifespan=lifespan)


def _error(status, code, message):
    """백엔드 공통 형식으로 에러를 낸다. JSONResponse.

    `global/response/ApiErrorResponse.java` 가 {code, message} 이므로 맞춘다.
    FastAPI 기본값은 {"detail": ...} 이라 그대로 두면 Spring 쪽 파싱이 갈린다.
    """
    return JSONResponse(status_code=status, content={"code": code, "message": message})


@app.exception_handler(RequestValidationError)
async def _on_validation_error(request: Request, exc: RequestValidationError):
    """입력이 형식에 안 맞으면 400 으로 낸다. FastAPI 기본은 422 다."""
    return _error(400, "NLR_INVALID_REQUEST",
                  f"text 는 1~{MAX_TEXT_CHARS}자여야 합니다.")


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


def _camel_conditions(understood):
    """조건 묶음. dict."""
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
    return {"status": "ok", "perfumes": index["n_perfumes"], "accords": len(index["accords"])}


@app.post("/nlr/understand")
def understand(body: UnderstandRequest, request: Request):
    """문장에서 향 조건만 뽑는다. dict.

    향수를 찾지 않는다. DB 에 향수가 채워져 Spring 이 SQL 로 검색하게 되어도
    이 엔드포인트는 그대로 쓴다.
    """
    index = request.app.state.index
    understood = nlr_engine.understand(index, body.text, body.conditions)
    result = {
        "query": body.text,
        "conditions": _camel_conditions(understood),
        "evidence": _camel_evidence(understood["evidence"]),
        "unmatched": _camel_unmatched(understood["unmatched"]),
    }
    unmatched_log.record({"query": body.text,
                          "unmatched": understood["unmatched"],
                          "conditions": {"core": understood["core"]}},
                         path=LOG_PATH)
    return result


@app.post("/nlr/recommend")
def recommend(body: RecommendRequest, request: Request):
    """문장 하나로 향수를 찾는다. dict.

    `status` 네 가지를 화면에서 구분해야 한다. 특히 `NO_CONDITION` 일 때
    **인기 향수를 대신 보여주면 안 된다** — 추천처럼 보이지만 근거가 없다.
    """
    index = request.app.state.index
    out = nlr_engine.recommend(index, body.text, body.conditions, top_k=body.topK)
    unmatched_log.record(out, path=LOG_PATH)
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
