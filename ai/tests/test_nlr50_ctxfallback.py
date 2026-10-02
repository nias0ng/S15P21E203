"""①단계가 실패했을 때(`structured=None`) 원문의 성별·계절·낮밤이 살아 있는지 본다.

    python -m unittest discover -s ai/tests

레드팀 2026-10-02 1-5 — ①단계가 꺼지면 `가을에 쓸 남성적인 우드향` 의 남성·가을이 조용히
사라졌다. **①단계가 성공한 경로(structured 가 있음)는 바뀌면 안 된다** 도 함께 본다.
"""
import logging
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nlr_engine  # noqa: E402

EMPTY_STAGE1 = {"scent_preference": ["Woody"],
                "context": {"season": [], "daypart": [], "gender": []},
                "performance": {"intensity": "", "longevity": ""},
                "avoid": [], "additional_requirements": []}


def _context(result):
    """matched_data 의 성별·계절·낮밤. dict[field, set]."""
    out = {}
    for m in result["matched_data"]:
        if m["field"] != "note":
            out.setdefault(m["field"], set()).add(m["value"])
    return out


class TextContextRuleTest(unittest.TestCase):
    """규칙만 — 인덱스 없이 돈다."""

    def check(self, text, want):
        got = {k: v for k, v in nlr_engine._text_context(text).items() if v}
        self.assertEqual(got, want, text)

    def test_reads_gender_season_daypart(self):
        self.check("가을에 쓸 남성적인 우드향", {"gender": ["male"], "season": ["autumn"]})
        self.check("여름밤에 어울리는 시트러스", {"season": ["summer"], "daypart": ["night"]})
        self.check("남녀 공용으로 쓸 향", {"gender": ["neuter"]})

    def test_english_needs_a_word_boundary(self):
        self.check("summer 에 쓸 향", {"season": ["summer"]})
        self.check("wintergreen 노트", {})

    def test_negated_value_is_not_applied(self):
        self.check("여름 말고 겨울에 쓸 우디 향", {"season": ["winter"]})
        self.check("남성용은 싫고 중성적인 향", {"gender": ["neuter"]})
        self.check("우디향을 좋아하는데 남성적인 향은 싫어", {})

    def test_negation_far_away_does_not_remove(self):
        # 부정이 계절이 아니라 `달달한` 에 걸린다
        self.check("여름에 쓰기 좋은데 달달한 건 싫어", {"season": ["summer"]})

    def test_words_that_only_contain_night_or_day(self):
        self.check("밤꽃 향", {})
        self.check("어제 꿀밤 맞아서 머리가 아파", {})
        self.check("꿀 향이 나는 립밤", {})
        self.check("확산력이 낮은 우디 향", {})
        self.check("낮에 회사에서 쓸 향", {"daypart": ["day"]})

    def test_partner_is_not_the_wearer(self):
        self.check("남자친구가 좋아할 향", {})
        self.check("여자 친구 선물", {})


class FallbackInRecommendTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()
        cls.row = {int(p): i for i, p in enumerate(cls.index["pid"])}

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def test_stage1_failure_keeps_gender_and_season(self):
        result = nlr_engine.recommend(self.index, "가을에 쓸 남성적인 우드향")
        self.assertEqual(_context(result), {"gender": {"male"}, "season": {"autumn"}})
        self.assertEqual(result["conditions"]["source"], "lexicon_only")
        male = self.index["context"]["gender"]["male"]
        autumn = self.index["context"]["season"]["autumn"]
        for item in result["results"]:
            row = self.row[item["perfume_id"]]
            self.assertTrue(male[row] and autumn[row], item["name"])

    def test_gender_only_sentence_is_answered(self):
        result = nlr_engine.recommend(self.index, "남자 향수 추천해줘")
        self.assertEqual(result["diagnostics"]["stage"], "CONTEXT_ONLY")
        self.assertEqual(_context(result), {"gender": {"male"}})

    def test_stage1_success_path_does_not_read_the_text(self):
        result = nlr_engine.recommend(self.index, "가을에 쓸 남성적인 우드향", structured=EMPTY_STAGE1)
        self.assertEqual(_context(result), {})

    def test_stage1_context_wins_over_the_text(self):
        structured = dict(EMPTY_STAGE1, context={"season": ["winter"], "daypart": [], "gender": ["female"]})
        result = nlr_engine.recommend(self.index, "여름에 쓸 남성용 향수", structured=structured)
        self.assertEqual(_context(result), {"gender": {"female"}, "season": {"winter"}})

    def test_empty_dict_is_not_a_failure(self):
        result = nlr_engine.recommend(self.index, "가을에 쓸 남성적인 우드향", structured={})
        self.assertEqual(_context(result), {})

    def test_sentence_without_context_words_is_unchanged(self):
        result = nlr_engine.recommend(self.index, "빨래 냄새 나는 향수 찾고 있어")
        self.assertEqual(result["matched_data"], [])


if __name__ == "__main__":
    unittest.main()
