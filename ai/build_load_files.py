"""향수 129,161개를 DB 에 넣을 수 있는 형태로 쪼갠다.

`data/perfumes_nlr.csv.gz` 한 칸에 뭉쳐 있는 값을 테이블 네 개로 나눈다.

    python build_load_files.py

입력은 읽기만 한다. 출력은 `delivery/for_db/` 아래에만 쓴다.

무엇을 만드는가
--------------
    brands.csv             name                                   7,797행
    accords.csv            name · is_new                             92행
    perfumes.csv.gz        fragrantica_id · name · brand_name ·  129,161행
                           people · already_in_db
    perfume_accords.csv.gz fragrantica_id · accord_name ·      1,000,570행
                           rank · weight

큰 둘만 gzip 으로 둔다. 압축하지 않으면 저장소에 넣기에 크고(각각 5.7MB·20MB),
`ai/.gitignore` 의 `perfumes.csv` 규칙에 걸려 조용히 빠진다. 작은 둘은 눈으로 열어
확인할 일이 많아 그대로 둔다 — 특히 `accords.csv` 는 새로 넣을 32개를 봐야 한다.

`brand_id` · `accord_id` · `perfume_id` 는 DB 가 만드는 번호라 여기서 채우지 않는다.
이름으로 넘기고 적재하는 쪽에서 이어 붙인다. 향 지도 인계 때와 같은 방식이다.

협의로 정해진 것 (2026-09-14)
----------------------------
  1. `people`(평가자 수)은 `perfumes` 에 컬럼을 추가해 담는다.
     없으면 추천 순서를 재현할 수 없다 — 정렬 2순위가 평가자 수다.
  2. `rating_avg`(평점)는 넣지 않는다. 추천 정렬에 쓰지 않는다.
  3. `uk_perfumes_brand_name UNIQUE (brand_id, name)` 제약을 빼고
     `UNIQUE (fragrantica_id)` 만 남긴다. 그래서 **129,161개가 전부 들어간다.**
     빼지 않으면 (브랜드, 이름) 이 겹치는 1,343행이 적재를 실패시킨다.

주의
----
**향 지도용 200개가 이 데이터에 전부 들어 있다.** 그대로 INSERT 하면 중복되거나
유니크 제약에 걸린다. `already_in_db` 가 `true` 인 행은 삽입이 아니라 갱신이다.
두 번 생기면 향 지도가 가리키는 향수와 추천이 가리키는 향수가 갈린다.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "data" / "perfumes_nlr.csv.gz"
ACCORD_MASTER = HERE / "data" / "accord_dictionary.csv"
OUTPUT_DIR = HERE / "delivery" / "for_db"

# DB 에 이미 들어 있는 것. 향 지도 인계본에서 뜬 값이라 **DB 의 실제 상태와 다를 수 있다.**
# 적재 전에 한 번 대조하는 것이 안전하다.
MAP_ACCORDS = HERE / "data" / "accords_already_in_db.csv"       # 60개
MAP_PERFUMES = HERE / "data" / "perfumes_already_in_db.csv"     # 200개


def parse_accords(value):
    """'name:strength|name:strength' 한 칸을 푼다. list[tuple[str, int]].

    세기 내림차순으로 이미 정렬돼 있다(129,161개 전부 확인). 순서가 곧 rank 다.
    """
    out = []
    for part in str(value).split("|"):
        if not part or part == "nan":
            continue
        name, _, raw = part.partition(":")
        try:
            out.append((name, int(float(raw))))
        except ValueError:
            continue
    return out


def build(source: Path = SOURCE, output_dir: Path = OUTPUT_DIR,
          already_in_db: Path | None = None) -> dict:
    """적재용 파일 네 개를 만든다. 요약 dict.

    source        : Path         data/perfumes_nlr.csv.gz
    output_dir    : Path         여기 아래에만 쓴다
    already_in_db : Path | None  DB 에 이미 있는 fragrantica_id 목록(1열 CSV).
                                 기본은 data/perfumes_already_in_db.csv 다.
    """
    already_in_db = already_in_db or MAP_PERFUMES
    if not source.is_file():
        raise FileNotFoundError(f"원본이 없습니다: {source}")

    df = pd.read_csv(source, usecols=["id", "name", "brand", "people", "accords"],
                     low_memory=False)
    output_dir.mkdir(parents=True, exist_ok=True)

    existing = set()
    if already_in_db and already_in_db.is_file():
        col = pd.read_csv(already_in_db)
        col.columns = [c.lstrip("﻿") for c in col.columns]
        existing = {int(v) for v in col.iloc[:, 0]}

    # --- brands -----------------------------------------------------------
    brands = (pd.Series(df["brand"].astype(str).unique(), name="name")
              .sort_values().reset_index(drop=True).to_frame())
    brands.to_csv(output_dir / "brands.csv", index=False)

    # --- accords ----------------------------------------------------------
    master = pd.read_csv(ACCORD_MASTER)["accord"].astype(str)
    in_db = set()
    if MAP_ACCORDS.is_file():
        col = pd.read_csv(MAP_ACCORDS)
        col.columns = [c.lstrip("﻿") for c in col.columns]
        in_db = {str(v) for v in col.iloc[:, 0]}
    accords = pd.DataFrame({"name": sorted(master)})
    accords["is_new"] = ~accords["name"].isin(in_db)
    accords.to_csv(output_dir / "accords.csv", index=False)

    # --- perfumes ---------------------------------------------------------
    perfumes = pd.DataFrame({
        "fragrantica_id": df["id"].astype("int64"),
        "name": df["name"].astype(str),
        "brand_name": df["brand"].astype(str),
        "people": df["people"].fillna(0).astype("int64"),
    })
    perfumes["already_in_db"] = perfumes["fragrantica_id"].isin(existing)
    perfumes.to_csv(output_dir / "perfumes.csv.gz", index=False, compression="gzip")

    # --- perfume_accords --------------------------------------------------
    ids, names, ranks, weights = [], [], [], []
    for fid, raw in zip(df["id"].astype("int64"), df["accords"]):
        for rank, (name, strength) in enumerate(parse_accords(raw), start=1):
            ids.append(fid)
            names.append(name)
            ranks.append(rank)
            weights.append(strength)
    pa = pd.DataFrame({"fragrantica_id": ids, "accord_name": names,
                       "rank": ranks, "weight": weights})
    pa.to_csv(output_dir / "perfume_accords.csv.gz", index=False, compression="gzip")

    def mb(name):
        return round((output_dir / name).stat().st_size / 1e6, 2)

    return {
        "brands": len(brands), "brands_mb": mb("brands.csv"),
        "accords": len(accords), "accords_new": int(accords["is_new"].sum()),
        "accords_mb": mb("accords.csv"),
        "perfumes": len(perfumes), "perfumes_mb": mb("perfumes.csv.gz"),
        "already_in_db": int(perfumes["already_in_db"].sum()),
        "perfume_accords": len(pa), "perfume_accords_mb": mb("perfume_accords.csv.gz"),
        "output_dir": str(output_dir),
    }


def main() -> None:
    """명령줄 실행."""
    parser = argparse.ArgumentParser(description="향수 DB 적재용 파일 생성")
    parser.add_argument("--source", default=str(SOURCE))
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR))
    parser.add_argument("--already-in-db", default=None,
                        help="DB 에 이미 있는 fragrantica_id 목록 CSV (1열)")
    args = parser.parse_args()

    s = build(Path(args.source), Path(args.output_dir),
              Path(args.already_in_db) if args.already_in_db else None)
    print(f"출력        {s['output_dir']}\n")
    print(f"  brands.csv           {s['brands']:>9,}행  {s['brands_mb']:>6}MB")
    print(f"  accords.csv          {s['accords']:>9,}행  {s['accords_mb']:>6}MB"
          f"   (새로 추가할 것 {s['accords_new']}개)")
    print(f"  perfumes.csv.gz         {s['perfumes']:>9,}행  {s['perfumes_mb']:>6}MB"
          f"   (이미 DB 에 있는 것 {s['already_in_db']}개)")
    print(f"  perfume_accords.csv.gz  {s['perfume_accords']:>9,}행  "
          f"{s['perfume_accords_mb']:>6}MB")


if __name__ == "__main__":
    main()
