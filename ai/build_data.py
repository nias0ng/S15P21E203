"""자연어 추천이 쓸 향수 데이터를 원본 덤프에서 만든다.

원본 Fragrantica 덤프(`perfumes.csv`, 127MB)에서 추천에 필요한 컬럼만 남기고
accord 가 없는 향수를 빼서 gzip 으로 저장한다. 결과는 약 5MB 라 저장소에 넣을 수 있다.

    python build_data.py --source /경로/perfumes.csv

원본은 읽기만 한다. `data/` 밖으로는 아무것도 쓰지 않는다.

왜 별도 파일을 두는가
--------------------
DB 의 `perfumes` 에는 향 지도용 향수 200개만 있고 `people`(평가자 수) 컬럼이 없다.
자연어 추천은 13만 개 전체를 뒤지고 평가자 수로 동점을 깨므로 SQL 로 구할 수 없다.
**DB 에 향수 전체가 들어가면 이 파일은 필요 없어진다.** 그때까지의 임시 조치다.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import pandas as pd

# 추천에 실제로 쓰는 컬럼만 남긴다. 나머지는 서비스가 보지 않는다.
KEEP_COLUMNS = ["id", "name", "brand", "accords", "people", "rating_avg"]

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
OUTPUT = DATA_DIR / "perfumes_nlr.csv.gz"


def sha256_head(path: Path, length: int = 16) -> str:
    """파일 해시 앞자리. 어느 원본으로 만들었는지 남기려고 쓴다. str."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()[:length]


def build(source: Path, output: Path = OUTPUT) -> dict:
    """원본에서 추천용 데이터를 만든다. 요약 dict."""
    if not source.is_file():
        raise FileNotFoundError(f"원본이 없습니다: {source}")

    source_hash = sha256_head(source)
    frame = pd.read_csv(source, usecols=KEEP_COLUMNS, low_memory=False)
    total = len(frame)

    # accord 가 없으면 어떤 조건으로도 검색되지 않는다. 들고 다닐 이유가 없다.
    has_accord = frame["accords"].notna() & (frame["accords"].astype(str).str.strip() != "")
    kept = frame[has_accord].copy()

    output.parent.mkdir(parents=True, exist_ok=True)
    kept.to_csv(output, index=False, compression="gzip")

    return {
        "source": str(source),
        "source_sha256_head": source_hash,
        "rows_in": total,
        "rows_out": len(kept),
        "rows_dropped": total - len(kept),
        "output": str(output),
        "output_mb": round(output.stat().st_size / 1e6, 2),
    }


def main() -> None:
    """명령줄 실행."""
    parser = argparse.ArgumentParser(description="자연어 추천용 향수 데이터 생성")
    parser.add_argument("--source", required=True,
                        help="원본 perfumes.csv 경로")
    parser.add_argument("--output", default=str(OUTPUT),
                        help=f"출력 경로 (기본: {OUTPUT.relative_to(HERE)})")
    args = parser.parse_args()

    summary = build(Path(args.source), Path(args.output))
    print(f"원본        {summary['source']}")
    print(f"  sha256    {summary['source_sha256_head']}")
    print(f"입력 행     {summary['rows_in']:,}")
    print(f"출력 행     {summary['rows_out']:,}  (accord 없어 제외 {summary['rows_dropped']:,})")
    print(f"출력        {summary['output']}  {summary['output_mb']}MB")


if __name__ == "__main__":
    main()
