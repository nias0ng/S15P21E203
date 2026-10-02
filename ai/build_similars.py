"""향수마다 '비슷한 향수' 10개를 미리 계산해 DB 적재용 CSV 로 씁니다.

    python build_similars.py                       # ai/ 에서. 2분 남짓 (13만 x 2.5만)
    python build_similars.py --out 다른/경로.csv.gz

**왜 미리 계산하는가.** 향수 상세의 '비슷한 향수'(`GET /perfumes/{id}/similar`)는 향 지도
200개끼리만 계산된 `perfume_neighbors` 를 읽어서, 지도 밖 12.9만 개의 상세에서는 그 구역이
통째로 사라졌습니다. 친구가 "미르토 디 파나레아와 비슷한 향수" 를 찾다 엠버 향수를 받은 것도
닮은 향을 찾는 길이 없어서였습니다 (지인 피드백 F3 · F16). 요청마다 13만 개와 견주면 느려서
여기서 한 번 계산해 둡니다.

**유사도 공식은 향 지도와 같습니다** — `frontend/landing/data/scent_map.json` 의
`similarity` (`accord_weight 0.5 · note_weight 0.5 · note_weighting idf`).

    유사도 = 0.5 x cos(향 특성 세기 벡터) + 0.5 x cos(노트 IDF 벡터)

이 식으로 지도 200개를 다시 계산하면 `perfume_map_neighbors.csv` 와 상위 10개가 평균 86%
겹치고 값도 소수 둘째 자리까지 같습니다(2026-10-01 실측). 남는 차이는 노트 원본이 달라서입니다
(지도는 단계가 붙은 원본 덤프, 여기는 `perfumes_nlr.csv.gz` 의 노트 목록).

**걸러 내는 규칙** — 유사도만으로 고르면 결과가 거의 무명 향수와 복제품입니다. Santal 33 의
1위가 평가자 474명짜리 복제품(유사도 0.988)이었습니다. 그래서 넷을 겁니다.

    후보는 평가자 CANDIDATE_MIN_PEOPLE 명 이상     처음 보는 사람이 다시 찾을 수 있는 향수만
    유사도 DUPE_SIMILARITY 이상은 뺌               다른 브랜드면 복제품, 같은 브랜드면 이름만
                                                  바꿔 다시 낸 판입니다. 진짜 '닮은 다른
                                                  향수' 는 이만큼 붙지 않습니다 (아래 실측)
    같은 브랜드는 하나까지, 같은 향수의 변형은 뺌     미르토의 '비슷한 향수' 가 미르토 리미티드
                                                  에디션 여섯 개로 차지 않게
    data/similar_exclude_brands.csv 의 브랜드는 뺌  'inspired by' 라인이 주력인 브랜드

유사도가 MIN_SIMILARITY 밑이면 10개를 못 채워도 거기서 멈춥니다 — 안 닮은 것을 닮았다고
내놓지 않습니다.

0.9 를 같은 브랜드에도 거는 이유 (2026-10-01 실측): 처음에는 다른 브랜드에만 걸었더니 0.9 이상
422쌍 중 417쌍이 같은 브랜드였고, 'Agent Provocateur' 와 'Diamond Dust Edition'(0.995)처럼
병만 바꿔 다시 낸 향수였습니다. 이름이 달라 변형판 규칙으로는 못 거릅니다.

numpy · pandas · scipy 가 필요합니다. 서버(server.py)는 이 스크립트를 쓰지 않아
requirements.txt 에 scipy 를 넣지 않았습니다 — `pip install scipy` 후 돌리십시오.

**메모리는 최고 1.4GB 쯤입니다** (2026-10-02 실측 — 확보 1,356MiB · 실사용 673MiB, 90초).
유사도는 BLOCK 행씩 후보 2.5만 개와 견주고 상위 POOL 개만 남겨, 13만 x 13만 행렬을 한 번에
펼치지 않습니다. 메모리가 모자란 곳에서 돌려야 하면 BLOCK 을 줄이십시오 — 계산은 같고 느려지기만
합니다. CI 와 서버는 이 스크립트를 돌리지 않습니다. 사람이 돌려 나온 CSV 를 커밋합니다.
"""
import argparse
import logging
import math
import re
import time
import unicodedata
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse

LOGGER = logging.getLogger("build_similars")

_DIR = Path(__file__).resolve().parent
DEFAULT_PERFUMES = _DIR / "data" / "perfumes_nlr.csv.gz"
DEFAULT_EXCLUDE = _DIR / "data" / "similar_exclude_brands.csv"
DEFAULT_OUT = _DIR.parent / "backend" / "db" / "seed" / "perfume_similars.csv.gz"

# Fragrantica 9110 은 988 의 크롤링 중복입니다 (nlr_engine.EXCLUDED_PERFUME_IDS 와 같습니다).
EXCLUDED_PERFUME_IDS = {9110}

ACCORD_WEIGHT = 0.5
NOTE_WEIGHT = 0.5
TOP_K = 10
CANDIDATE_MIN_PEOPLE = 100
DUPE_SIMILARITY = 0.9
MIN_SIMILARITY = 0.3
# 걸러 낼 몫까지 넉넉히 뽑아 둡니다. 80 이면 13만 개 중 10개를 못 채우는 향수가 6개뿐입니다.
POOL = 80
BLOCK = 512

# 변형판을 가를 때 이름에서 지우는 말 — 농도 · 판 · 성별처럼 '같은 향수의 다른 판' 을 만드는 말입니다
_VARIANT_NOISE = {
    "eau", "de", "du", "di", "la", "le", "l", "the", "parfum", "perfume", "toilette", "cologne",
    "edp", "edt", "extrait", "intense", "limited", "edition", "special", "summer", "collector",
    "absolu", "elixir", "forte", "riserva", "concentree", "legere", "fraiche", "pour", "homme",
    "femme", "men", "women", "him", "her", "blu", "mediterraneo", "and", "et", "no",
}


def _vectors(perf):
    """향 특성 · 노트 벡터. 둘 다 길이 1 로 맞춘 float32 (dense, csr)."""
    names = sorted({a.rpartition(":")[0] for s in perf["accords"].dropna() for a in s.split("|")})
    col = {a: i for i, a in enumerate(names)}
    rows, cols, vals = [], [], []
    for r, s in enumerate(perf["accords"]):
        if isinstance(s, str):
            for a in s.split("|"):
                key, _, weight = a.rpartition(":")
                rows.append(r)
                cols.append(col[key])
                vals.append(float(weight))
    n = len(perf)
    accords = sparse.csr_matrix((vals, (rows, cols)), shape=(n, len(names)),
                                dtype=np.float32).toarray()

    notes = perf["notes"].fillna("").str.split("|")
    df = Counter(note for ns in notes for note in set(ns) if note)
    vocab = {note: i for i, note in enumerate(df)}
    rows, cols, vals = [], [], []
    for r, ns in enumerate(notes):
        for note in set(ns):
            if note:
                rows.append(r)
                cols.append(vocab[note])
                vals.append(math.log(n / df[note]))
    note_matrix = sparse.csr_matrix((vals, (rows, cols)), shape=(n, len(vocab)),
                                    dtype=np.float32)

    norm = np.sqrt((accords * accords).sum(1, keepdims=True))
    norm[norm == 0] = 1
    accords = (accords / norm).astype(np.float32)
    norm = np.sqrt(np.asarray(note_matrix.multiply(note_matrix).sum(1))).ravel()
    norm[norm == 0] = 1
    note_matrix = sparse.diags(1 / norm).dot(note_matrix).tocsr().astype(np.float32)
    return accords, note_matrix


def _pool(accords, notes, candidates):
    """향수마다 후보 중 유사도 상위 POOL 개. (번호 배열, 유사도 배열)."""
    n = accords.shape[0]
    cidx = np.where(candidates)[0]
    accords_t = accords[cidx].T.copy()
    notes_t = notes[cidx].T.tocsr()
    top_idx = np.zeros((n, POOL), dtype=np.int32)
    top_sim = np.zeros((n, POOL), dtype=np.float32)
    started = time.time()
    for s in range(0, n, BLOCK):
        e = min(n, s + BLOCK)
        sim = ACCORD_WEIGHT * (accords[s:e] @ accords_t) \
            + NOTE_WEIGHT * (notes[s:e] @ notes_t).toarray()
        # 자기 자신은 후보에서 뺀다
        own = np.arange(s, e)
        pos = np.searchsorted(cidx, own)
        hit = (pos < len(cidx)) & (cidx[np.minimum(pos, len(cidx) - 1)] == own)
        sim[np.where(hit)[0], pos[hit]] = -1
        part = np.argpartition(-sim, POOL, axis=1)[:, :POOL]
        part_sim = np.take_along_axis(sim, part, 1)
        order = np.argsort(-part_sim, axis=1)
        top_idx[s:e] = cidx[np.take_along_axis(part, order, 1)]
        top_sim[s:e] = np.take_along_axis(part_sim, order, 1)
        if s % (BLOCK * 40) == 0:
            LOGGER.info("%d / %d (%.0f초)", s, n, time.time() - started)
    return top_idx, top_sim


def _variant_core(name):
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return {t for t in re.findall(r"[a-z]+", text) if t not in _VARIANT_NOISE and len(t) > 1}


def _is_variant(core_a, core_b, name_a, name_b):
    """같은 브랜드 안에서 같은 향수의 다른 판인가 — 이름의 핵심 낱말이 겹치면 그렇다고 봅니다."""
    if not core_a or not core_b:
        return name_a.lower() == name_b.lower()
    return core_a <= core_b or core_b <= core_a \
        or len(core_a & core_b) / len(core_a | core_b) >= 0.5


def build(perfumes_csv=DEFAULT_PERFUMES, exclude_csv=DEFAULT_EXCLUDE):
    """(fragrantica_id, similar_fragrantica_id, similarity, rank) DataFrame."""
    perf = pd.read_csv(perfumes_csv)
    perf = perf[~perf["id"].isin(EXCLUDED_PERFUME_IDS)].reset_index(drop=True)
    excluded = set(pd.read_csv(exclude_csv)["brand"].astype(str))

    accords, notes = _vectors(perf)
    people = perf["people"].fillna(0).to_numpy()
    brand = perf["brand"].astype(str).to_numpy()
    candidates = (people >= CANDIDATE_MIN_PEOPLE) & ~np.isin(brand, list(excluded))
    LOGGER.info("향수 %d개 · 후보 %d개", len(perf), int(candidates.sum()))

    top_idx, top_sim = _pool(accords, notes, candidates)

    ids = perf["id"].to_numpy()
    name = perf["name"].astype(str).to_numpy()
    cores = [_variant_core(n) for n in name]
    out = []
    for i in range(len(perf)):
        brands = set()
        rank = 0
        for j, s in zip(top_idx[i], top_sim[i]):
            if s < MIN_SIMILARITY:
                break
            if s >= DUPE_SIMILARITY:
                continue
            if brand[j] == brand[i] and _is_variant(cores[i], cores[j], name[i], name[j]):
                continue
            if brand[j] in brands:
                continue
            brands.add(brand[j])
            rank += 1
            out.append((int(ids[i]), int(ids[j]), round(float(s), 4), rank))
            if rank == TOP_K:
                break
    return pd.DataFrame(out, columns=["fragrantica_id", "similar_fragrantica_id",
                                      "similarity", "rank"])


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--perfumes", type=Path, default=DEFAULT_PERFUMES)
    parser.add_argument("--exclude", type=Path, default=DEFAULT_EXCLUDE)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    table = build(args.perfumes, args.exclude)
    table.to_csv(args.out, index=False, compression={"method": "gzip", "mtime": 0})
    per = table.groupby("fragrantica_id").size()
    LOGGER.info("향수 %d개 · 짝 %d개 · 10개를 못 채운 향수 %d개 -> %s",
                per.size, len(table), int((per < TOP_K).sum()), args.out)


if __name__ == "__main__":
    main()
