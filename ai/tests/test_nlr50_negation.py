"""부정 표현 · 사전 경로 오탐이 되살아나지 않는지 본다 [레드팀 1-2 · 1-3 · 1-9 · 50번 ④].

    python -m unittest discover -s tests

①단계(GMS) 없이 돈다. `structured=None` 은 ①단계가 실패해 서버가 원문만 넘기는 경로이고,
`structured` 를 넣은 것은 ①단계가 부정을 `additional_requirements` 에 넣은 경로다.
"""
import logging
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nlr_engine  # noqa: E402


def _stage1(*requirements, preference=(), avoid=()):
    """①단계 출력 모양. dict."""
    return {"scent_preference": list(preference),
            "context": {"season": [], "daypart": [], "gender": []},
            "performance": {"intensity": "", "longevity": ""},
            "avoid": list(avoid), "additional_requirements": list(requirements)}


def _notes(result):
    return {m["value"] for m in result["matched_data"] if m["field"] == "note"}


class NegationTest(unittest.TestCase):
    """2b — 표면형 뒤에 부정이 오면 조건으로 쓰지 않는다."""

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def run_engine(self, text, structured=None):
        return nlr_engine.recommend(self.index, text, structured=structured)

    def test_no_tobacco_when_stage1_failed(self):
        # ①단계가 실패하면 원문만 본다. 전에는 tobacco 강도 86~100 향수 5개가 나갔다.
        result = self.run_engine("담배 냄새 안 나는 향수")
        self.assertNotIn("tobacco", result["conditions"]["core"])
        self.assertNotIn("tobacco", _notes(result))

    def test_no_tobacco_from_additional_requirements(self):
        text = "담배 냄새 안 나는 향수"
        result = self.run_engine(text, _stage1(text))
        self.assertNotIn("tobacco", result["conditions"]["core"])
        self.assertNotIn("tobacco", _notes(result))

    def test_disliked_sweet_is_not_core_but_the_rest_stays(self):
        result = self.run_engine("달달한 건 싫어, 상큼한 향")
        core = result["conditions"]["core"]
        self.assertNotIn("sweet", core)
        self.assertNotIn("caramel", core)
        self.assertIn("citrus", core)

    def test_not_too_sweet_keeps_the_liked_accord(self):
        text = "앰버 계열 좋아하는데 달달하지 않은 거"
        result = self.run_engine(text, _stage1("달달하지 않은 향", preference=["amber"]))
        core = result["conditions"]["core"]
        self.assertIn("amber", core)
        self.assertNotIn("sweet", core)

    def test_positive_sentences_are_kept(self):
        # 부정이 없는 문장은 그대로다 — 두 경로 모두.
        text = "달달하고 포근한 향"
        self.assertIn("sweet", self.run_engine(text)["conditions"]["core"])
        self.assertIn("sweet", self.run_engine(text, _stage1(text))["conditions"]["core"])
        text = "담배 향 나는 남자 향수"
        self.assertIn("tobacco", self.run_engine(text)["conditions"]["core"])
        self.assertIn("tobacco", _notes(self.run_engine(text, _stage1(preference=["Tobacco"]))))

    def test_negation_belongs_to_its_own_clause(self):
        # `-고` 로 넘어간 절의 `싫어` 는 앞 표면형의 것이 아니다.
        core = self.run_engine("바닐라는 좋고 담배는 싫어")["conditions"]["core"]
        self.assertIn("vanilla", core)
        self.assertNotIn("tobacco", core)
        core = self.run_engine("장미 말고 머스크")["conditions"]["core"]
        self.assertIn("musky", core)
        self.assertNotIn("rose", core)


class BlockedWordTest(unittest.TestCase):
    """2c-1 — 향이 아닌 낱말 안의 표면형을 조건으로 쓰지 않는다."""

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def core(self, text, structured=None):
        return nlr_engine.recommend(self.index, text, structured=structured)["conditions"]["core"]

    def test_names_and_idioms_make_no_condition(self):
        cases = {
            "테슬라 일론 머스크 주식 어때?": ("musky", "soapy"),
            "우디 앨런 영화 추천해줘": ("woody",),
            "앰버 허드 같은 여배우 느낌": ("amber",),     # 검문소가 `허드` 를 `허브` 로 고치던 문장
            "달달 볶이는 회사생활 너무 힘들다": ("sweet", "caramel"),
            "꿀잼 느낌 나는 게임 추천": ("sweet",),
            "숲세권 아파트 시세 알려줘": ("woody",),
        }
        for text, accords in cases.items():
            for structured in (None, _stage1(text)):
                with self.subTest(text=text, stage1=structured is not None):
                    core = self.core(text, structured)
                    for accord in accords:
                        self.assertNotIn(accord, core)

    def test_the_scent_words_themselves_still_work(self):
        cases = {"머스크 향 좋아해": "musky", "우디한 향": "woody", "앰버 향": "amber",
                 "달달한 향": "sweet", "숲 냄새": "woody", "꿀 향 나는 향수": "sweet"}
        for text, accord in cases.items():
            with self.subTest(text=text):
                self.assertIn(accord, self.core(text))


if __name__ == "__main__":
    unittest.main()
