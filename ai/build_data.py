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
# 향수가 가진 노트. 원본이 네 칸으로 갈라 두었고 **서로 채운다** —
# `notes_flat` 은 결측이 72.5% 인데 tiered 셋과 합치면 보유가 98% 가 넘는다
# [측정 기록 34번의 정정]. 합쳐서 한 칸으로 싣는다.
NOTE_COLUMNS = ["notes_top", "notes_middle", "notes_base", "notes_flat"]

SEASON_COLUMNS = ["winter", "spring", "summer", "autumn"]
DAYPART_COLUMNS = ["day", "night"]
# 성별 투표 5단계 척도 -> 세 방향. **이름으로 묶는다.**
# 위치로 묶으면 원본 컬럼 순서가 바뀌었을 때 남녀가 조용히 뒤바뀐다 — 예외도 안 난다.
GENDER_VOTE_GROUPS = {
    "male": ["perceived_male", "perceived_male_leaning"],
    "female": ["perceived_female", "perceived_female_leaning"],
    "unisex": ["perceived_unisex"],
}
PERCEIVED_COLUMNS = [c for group in GENDER_VOTE_GROUPS.values() for c in group]

# 성별 투표가 0표인 향수를 메울 값. 공식 `gender` 등급별로 **투표 100표 이상인 향수에서
# 잰 평균**이다. 지어낸 값이 아니다 [측정 기록 35번].
# 엔진 모집단(people>=10)에서 0표는 1.74% 다.
GENDER_PRIOR = {
    "male": {"male": 0.824, "female": 0.027, "unisex": 0.149},
    "female": {"male": 0.020, "female": 0.834, "unisex": 0.146},
    "unisex": {"male": 0.247, "female": 0.310, "unisex": 0.442},
}
assert set(GENDER_PRIOR) == set(GENDER_VOTE_GROUPS), "성별 방향 목록이 어긋난다"
assert all(set(v) == set(GENDER_VOTE_GROUPS) for v in GENDER_PRIOR.values()), \
    "GENDER_PRIOR 의 방향 이름이 어긋난다"

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
OUTPUT = DATA_DIR / "perfumes_nlr.csv.gz"


def _notes(frame: pd.DataFrame) -> pd.Series:
    """향수가 가진 노트를 한 칸으로 합친다. pd.Series[str] — `amber|basil|cedar`.

    frame : DataFrame  `NOTE_COLUMNS` 를 가진 표

    네 칸을 파이프로 쪼개 합치고 **소문자로 낮춰 중복을 없앤 뒤 정렬**한다.
    엔진이 부분 문자열로 찾으므로(`_note_rows`) 대소문자를 여기서 통일해 둔다.

    **칸을 거르지 않고 전부 싣는다.** 지금 엔진이 찾는 것은 별칭표가 가리키는
    882종뿐이지만, 걸러서 실으면 향수의 71.4% 에서 노트 목록이 달라져
    나중에 화면에 노트를 보여 주는 기능이 이 파일을 쓸 때 곤란해진다.
    걸렀을 때 7.15MB, 전부 실으면 7.83MB 다 [측정 기록 35번].
    """
    def merge(row) -> str:
        out = []
        for column in NOTE_COLUMNS:
            value = row[column]
            if isinstance(value, str):
                out += [x.strip().lower() for x in value.split("|") if x.strip()]
        return "|".join(sorted(set(out)))
    return frame[NOTE_COLUMNS].apply(merge, axis=1)


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
    """커뮤니티 투표로 본 성별 방향. pd.Series[str] — `male` · `female|unisex` 등.

    frame : DataFrame  `PERCEIVED_COLUMNS` 와 `gender` 를 가진 표

    Fragrantica 의 성별 투표는 5단계 척도(여성 - 여성 쪽 - 중성 - 남성 쪽 - 남성)다.
    `GENDER_VOTE_GROUPS` 대로 세 덩어리로 묶어 비율을 내고 가장 큰 쪽을 싣는다.

        남성 = (남성 + 남성 쪽) / 전체     여성 = (여성 + 여성 쪽) / 전체     중성 = 중성 / 전체

    **칸을 위치가 아니라 이름으로 고른다.** 예전에는 `votes[:, 4] + votes[:, 3]` 처럼
    적었는데, 그러면 `PERCEIVED_COLUMNS` 순서가 바뀌었을 때 **남녀가 조용히 뒤바뀐다**
    — 예외도 안 나고 테스트도 없다 [MR 리뷰 지적].

    **공식 `gender` 3값을 쓰지 않는 이유** — 공식 `unisex` 가 후보의 47%인데 그중
    투표로도 중성인 것은 48.7% 뿐이다. 나머지는 남성 쪽이나 여성 쪽으로 기운다
    (`Layton` 남성 0.85 · `Lost Cherry` 여성 0.68 이 같은 unisex 칸에 있다) [35번].

    **투표가 0표면 공식 `gender` 등급의 평균으로 메운다.** 엔진 모집단에서 1.74% 다.
    """
    directions = list(GENDER_VOTE_GROUPS)                  # 칸 순서를 여기서 한 번만 정한다
    votes = frame[PERCEIVED_COLUMNS].fillna(0).to_numpy(dtype=float)
    total = votes.sum(axis=1)
    voted = total > 0

    score = np.zeros((len(frame), len(directions)), dtype=float)
    for i, direction in enumerate(directions):
        group = frame[GENDER_VOTE_GROUPS[direction]].fillna(0).to_numpy(dtype=float)
        score[voted, i] = group[voted].sum(axis=1) / total[voted]

    official = frame["gender"].fillna("").astype(str).to_numpy()
    for name, prior in GENDER_PRIOR.items():
        score[(~voted) & (official == name)] = [prior[d] for d in directions]
    unknown = (~voted) & ~np.isin(official, list(GENDER_PRIOR))
    if unknown.any():                 # 공식 등급도 없고 투표도 없으면 어느 쪽도 아니다
        score[unknown] = 0.0
    # **동점이면 둘 다 싣는다** (`male|unisex`). 계절·낮밤과 같은 방식이다.
    # `argmax` 로 하나만 고르면 **딕셔너리 순서가 승자를 정한다** — 투표가 있는
    # 향수의 3.83% 가 동점이라 적지 않다 [MR 리뷰 지적].
    top = (score == score.max(axis=1, keepdims=True)) & ~unknown[:, None]
    lead = ["|".join(d for i, d in enumerate(directions) if row[i]) for row in top]
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
    usecols = (KEEP_COLUMNS + NOTE_COLUMNS + SEASON_COLUMNS + DAYPART_COLUMNS
               + PERCEIVED_COLUMNS + ["gender"])
    frame = pd.read_csv(source, usecols=usecols, low_memory=False)
    total = len(frame)

    # accord 가 없으면 어떤 조건으로도 검색되지 않는다. 들고 다닐 이유가 없다.
    has_accord = frame["accords"].notna() & (frame["accords"].astype(str).str.strip() != "")
    kept = frame[has_accord].copy()

    # ①단계의 `context` 조건을 검색에 쓰려면 이 세 칸이 필요하다 [측정 기록 35번].
    # **투표 수가 아니라 1등 방향만 싣는다** — 지금 검색이 쓰는 것이 그것뿐이고
    # 파일이 +19.7% 대신 +7.0% 만 커진다.
    # 사용자가 말한 노트를 가진 향수를 앞으로 당기려면 이 칸이 필요하다 [35번].
    kept["notes"] = _notes(kept)
    kept["gender_lead"] = _gender_lead(kept)
    kept["season_lead"] = _lead(kept, SEASON_COLUMNS)
    kept["daypart_lead"] = _lead(kept, DAYPART_COLUMNS)
    kept = kept[KEEP_COLUMNS + ["notes", "gender_lead", "season_lead", "daypart_lead"]]

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
        "notes_empty": int((kept["notes"] == "").sum()),
        "notes_per_perfume": round(
            kept["notes"].map(lambda v: len(v.split("|")) if v else 0).mean(), 1),
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
    print(f"노트 없음    {summary['notes_empty']:,}  ·  향수당 평균 {summary['notes_per_perfume']}개")
    print(f"성별 방향    {summary['gender_lead']}")
    print(f"계절 없음    {summary['season_lead_empty']:,}  ·  낮밤 없음 {summary['daypart_lead_empty']:,}")


if __name__ == "__main__":
    main()
