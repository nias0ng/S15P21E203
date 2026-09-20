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

import numpy as np
import pandas as pd

# 원본에서 그대로 싣는 컬럼. 나머지는 서비스가 보지 않는다.
KEEP_COLUMNS = ["id", "name", "brand", "accords", "people", "rating_avg"]

# 원본에서 읽되 **그대로 싣지 않고 1등 방향으로 접어서** 싣는 컬럼들.
# 투표 수를 그대로 실으면 +19.7% 인데 1등만 실으면 +7.0% 이고,
# 엔진이 쓰는 것은 "1등이 무엇인가" 뿐이다 [측정 기록 35번].
SEASON_COLUMNS = ["winter", "spring", "summer", "autumn"]
DAYPART_COLUMNS = ["day", "night"]
PERCEIVED_COLUMNS = ["perceived_female", "perceived_female_leaning", "perceived_unisex",
                     "perceived_male_leaning", "perceived_male"]

# 성별 투표가 0표인 향수를 메울 값. 공식 `gender` 등급별로 **투표 100표 이상인 향수에서
# 잰 평균**이다 (남성 · 여성 · 중성 점수). 지어낸 값이 아니다 [측정 기록 35번].
# 엔진 모집단(people>=10)에서 0표는 1.74% 다.
GENDER_PRIOR = {
    "male": (0.824, 0.027, 0.149),
    "female": (0.020, 0.834, 0.146),
    "unisex": (0.247, 0.310, 0.442),
}
GENDER_LEAD_NAMES = ("male", "female", "unisex")

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
OUTPUT = DATA_DIR / "perfumes_nlr.csv.gz"


def _lead(frame: pd.DataFrame, columns: list[str]) -> pd.Series:
    """투표 수가 가장 많은 칸의 이름. pd.Series[str] (동률이면 `|` 로 잇는다).

    frame   : DataFrame  `columns` 를 가진 표
    columns : list[str]  서로 비교할 투표 수 칸들

    전부 0표면 빈 문자열이다 — 엔진이 그 향수를 어느 쪽으로도 세지 않는다.
    **비율이 아니라 1등 이름만 싣는다.** 지금 검색이 쓰는 것이 그것뿐이다.
    """
    votes = frame[columns].fillna(0).to_numpy(dtype=float)
    top = (votes == votes.max(axis=1, keepdims=True)) & (votes.sum(axis=1, keepdims=True) > 0)
    return pd.Series(["|".join(c for i, c in enumerate(columns) if row[i]) for row in top],
                     index=frame.index)


def _gender_lead(frame: pd.DataFrame) -> pd.Series:
    """커뮤니티 투표로 본 성별 방향. pd.Series[str] — male / female / unisex.

    frame : DataFrame  `PERCEIVED_COLUMNS` 와 `gender` 를 가진 표

    Fragrantica 의 성별 투표는 5단계 척도(여성 - 여성 쪽 - 중성 - 남성 쪽 - 남성)다.
    세 덩어리로 묶어 비율을 내고 가장 큰 쪽을 싣는다.

        남성 = (남성 + 남성 쪽) / 전체     여성 = (여성 + 여성 쪽) / 전체     중성 = 중성 / 전체

    **공식 `gender` 3값을 쓰지 않는 이유** — 공식 `unisex` 가 후보의 47%인데 그중
    투표로도 중성인 것은 48.7% 뿐이다. 나머지는 남성 쪽이나 여성 쪽으로 기운다
    (`Layton` 남성 0.85 · `Lost Cherry` 여성 0.68 이 같은 unisex 칸에 있다) [35번].

    **투표가 0표면 공식 `gender` 등급의 평균으로 메운다.** 엔진 모집단에서 1.74% 다.
    """
    votes = frame[PERCEIVED_COLUMNS].fillna(0).to_numpy(dtype=float)
    total = votes.sum(axis=1)
    score = np.zeros((len(frame), 3), dtype=float)
    voted = total > 0
    score[voted, 0] = (votes[voted, 4] + votes[voted, 3]) / total[voted]   # 남성
    score[voted, 1] = (votes[voted, 0] + votes[voted, 1]) / total[voted]   # 여성
    score[voted, 2] = votes[voted, 2] / total[voted]                        # 중성

    official = frame["gender"].fillna("").astype(str).to_numpy()
    for name, prior in GENDER_PRIOR.items():
        score[(~voted) & (official == name)] = prior
    unknown = (~voted) & ~np.isin(official, list(GENDER_PRIOR))
    if unknown.any():                 # 공식 등급도 없고 투표도 없으면 어느 쪽도 아니다
        score[unknown] = 0.0
    lead = np.array(GENDER_LEAD_NAMES)[score.argmax(axis=1)]
    lead[unknown] = ""
    return pd.Series(lead, index=frame.index)


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
    usecols = KEEP_COLUMNS + SEASON_COLUMNS + DAYPART_COLUMNS + PERCEIVED_COLUMNS + ["gender"]
    frame = pd.read_csv(source, usecols=usecols, low_memory=False)
    total = len(frame)

    # accord 가 없으면 어떤 조건으로도 검색되지 않는다. 들고 다닐 이유가 없다.
    has_accord = frame["accords"].notna() & (frame["accords"].astype(str).str.strip() != "")
    kept = frame[has_accord].copy()

    # ①단계의 `context` 조건을 검색에 쓰려면 이 세 칸이 필요하다 [측정 기록 35번].
    # **투표 수가 아니라 1등 방향만 싣는다** — 지금 검색이 쓰는 것이 그것뿐이고
    # 파일이 +19.7% 대신 +7.0% 만 커진다.
    kept["gender_lead"] = _gender_lead(kept)
    kept["season_lead"] = _lead(kept, SEASON_COLUMNS)
    kept["daypart_lead"] = _lead(kept, DAYPART_COLUMNS)
    kept = kept[KEEP_COLUMNS + ["gender_lead", "season_lead", "daypart_lead"]]

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
        "gender_lead": kept["gender_lead"].value_counts().to_dict(),
        "season_lead_empty": int((kept["season_lead"] == "").sum()),
        "daypart_lead_empty": int((kept["daypart_lead"] == "").sum()),
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
    print(f"성별 방향    {summary['gender_lead']}")
    print(f"계절 없음    {summary['season_lead_empty']:,}  ·  낮밤 없음 {summary['daypart_lead_empty']:,}")


if __name__ == "__main__":
    main()
