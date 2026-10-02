"""회피(avoid)가 거꾸로 작동하던 결함이 되살아나지 않는지 본다 [레드팀 2026-10-02 1-3 · nlr50 ③].

    python -m unittest discover -s ai/tests

**운영 경로대로 `structured` 를 넣는다.** ①단계(GMS)는 부르지 않는다 — ①단계 출력을
손으로 적어 넣는다. 인덱스는 한 번만 만든다.
"""
import logging
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nlr_engine  # noqa: E402


def _structured(pref=(), avoid=(), additional=()):
    return {"scent_preference": list(pref), "avoid": list(avoid),
            "additional_requirements": list(additional),
            "context": {"season": [], "daypart": [], "gender": []},
            "performance": {"intensity": "", "longevity": ""}}


class AvoidTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()
        cls.notes_of = {}
        for note, rows in cls.index["notes"].items():
            for row in rows:
                cls.notes_of.setdefault(int(row), set()).add(note)
        cls.row_of = {int(pid): row for row, pid in enumerate(cls.index["pid"])}

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def run_case(self, text, structured):
        return nlr_engine.recommend(self.index, text, structured=structured)

    def result_notes(self, result):
        return [self.notes_of.get(self.row_of[r["perfume_id"]], set()) for r in result["results"]]

    def test_avoided_note_does_not_erase_liked_accord(self):
        # 레드팀 1-3. 전에는 tonka 의 브리지(sweet·vanilla·amber)가 vanilla 를 지워 core 가 비고
        # 인기순 5개 중 4개에 tonka bean 이 있었다.
        result = self.run_case("바닐라 좋은데 통카빈은 빼줘",
                               _structured(pref=["Vanilla"], avoid=["Tonka Bean"]))
        self.assertIn("vanilla", result["conditions"]["core"])
        self.assertTrue(result["results"])
        for notes in self.result_notes(result):
            self.assertNotIn("tonka bean", notes)

    def test_korean_avoid_note_takes_the_same_path(self):
        en = self.run_case("바닐라 좋은데 통카빈은 빼줘",
                           _structured(pref=["Vanilla"], avoid=["Tonka Bean"]))
        ko = self.run_case("바닐라 좋은데 통카빈은 빼줘",
                           _structured(pref=["Vanilla"], avoid=["통카빈"]))
        self.assertEqual([r["perfume_id"] for r in en["results"]],
                         [r["perfume_id"] for r in ko["results"]])

    def test_note_avoid_compares_whole_words(self):
        # `rose` 회피가 tuberose · rosemary 를 지우면 안 된다(부분 문자열 비교였다면 지운다).
        # `bulgarian rose` 는 같은 노트로 지운다.
        mask = nlr_engine._avoid_note_rows(self.index, _structured(avoid=["Rose"]))
        where = self.index["notes"]
        rose_like = set()
        for note, rows in where.items():
            if {"rose", "roses"} & set(note.replace("(", " ").replace(")", " ").split()):
                rose_like.update(int(r) for r in rows)
        only_tuberose = [int(r) for r in where["tuberose"] if int(r) not in rose_like]
        only_rosemary = [int(r) for r in where["rosemary"] if int(r) not in rose_like]
        self.assertTrue(only_tuberose and only_rosemary)
        self.assertFalse(mask[only_tuberose].any())
        self.assertFalse(mask[only_rosemary].any())
        self.assertTrue(mask[where["bulgarian rose"]].all())

    def test_floral_survives_rose_avoid(self):
        # 설문 SQ0029. 전에는 rose 의 브리지가 floral 을 지워 조건 0개였다.
        result = self.run_case("꽃향은 좋은데 로즈는 싫어",
                               _structured(avoid=["Rose"], additional=["꽃향은 선호"]))
        self.assertIn("floral", result["conditions"]["core"])
        for notes in self.result_notes(result):
            self.assertNotIn("rose", notes)

    def test_avoided_word_does_not_count_as_wanted(self):
        # 회피한 말이 만든 조건을 "원한 것" 으로 세면 안 된다 — `장미는 싫어` 에서 floral 이 살아나면 거꾸로다.
        result = self.run_case("장미는 싫어", _structured(avoid=["rose"]))
        self.assertNotIn("floral", result["conditions"]["core"])
        self.assertNotIn("rose", result["conditions"]["core"])

    def test_musk_avoid_keeps_soap_asked_separately(self):
        # 레드팀 t4-20. 사전 kr.drift.musk 가 머스크를 musky+soapy 로 묶어 비누로 원한 soapy 까지 막았다.
        result = self.run_case("머스크는 절대 싫어요, 깨끗한 비누 향",
                               _structured(avoid=["머스크"], additional=["깨끗한 비누 향"]))
        self.assertIn("soapy", result["conditions"]["core"])
        self.assertNotIn("musky", result["conditions"]["core"])

    def test_english_musk_avoid_drops_soap_from_korean_text(self):
        # 설문 SQ0103. avoid 는 영어(`musk`)인데 원문의 `머스크` 가 soapy 를 조건으로 남겼다.
        text = ("음 나는 머스크는 싫어 그리고 장미향도 싫어 그리구 나는 데일리로 사계절 내내 쓰고 "
                "싶어 무난하게 호불호 없는 향수 추천해줘")
        result = self.run_case(text, _structured(avoid=["musk", "rose"],
                                                 additional=["호불호 없는 데일리용", "사계절 내내 사용"]))
        self.assertNotIn("soapy", result["conditions"]["core"])
        for notes in self.result_notes(result):
            self.assertNotIn("musk", notes)
            self.assertNotIn("rose", notes)

    def test_lexicon_avoid_still_blocks(self):
        # 회피 문구가 사전 표면형이면 지금처럼 막는다 (레드팀 keep c09b).
        result = self.run_case("앰버 계열 좋아하는데 달달하지 않은 거",
                               _structured(pref=["amber"], avoid=["달달한 향"]))
        self.assertIn("amber", result["conditions"]["core"])
        self.assertNotIn("sweet", result["conditions"]["core"])
        self.assertNotIn("caramel", result["conditions"]["core"])


if __name__ == "__main__":
    unittest.main()
