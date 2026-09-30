"""지인 사용성 피드백에서 나온 엔진 결함이 되살아나지 않는지 본다.

    python -m unittest discover -s ai/tests

LLM(①단계) 없이 사전 경로만 돈다. 인덱스를 한 번만 만든다 — 13만 x 92 행렬이라
테스트마다 만들면 수십 초가 걸린다.
"""
import logging
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nlr_engine  # noqa: E402


def _notes(result):
    return {(m["label"], m["value"]) for m in result["matched_data"] if m["field"] == "note"}


class FeedbackGuardTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def aliases(self, text):
        return nlr_engine._longest_alias_ko(self.index, text)

    def test_perfume_name_is_not_read_as_myrrh(self):
        # 친구가 실제로 넣은 문장이다. 미르토 안의 미르가 myrrh 로 읽혀 앰버 향수가 1위였다.
        result = nlr_engine.recommend(self.index, "아쿠아디파르마 미르토 디 파나레아와 비슷한 향수")
        self.assertNotIn("myrrh", {value for _, value in _notes(result)})
        self.assertNotIn("Galaor", [r["name"] for r in result["results"]])

    def test_blocked_words_hide_the_alias_inside(self):
        for word in ("미르토", "카스미르", "다이아몬드", "서블라임", "클라우드", "페어리",
                     "니나리치", "타임리스", "인크레더블"):
            with self.subTest(word=word):
                self.assertEqual(self.aliases(word), [])

    def test_real_notes_are_still_found(self):
        # 가린 낱말 앞뒤의 별칭과, 별칭 자체를 쓴 문장은 그대로 찾아야 한다.
        cases = {
            "미르향": ["미르"],
            "몰약 향": ["몰약"],
            "장미꽃": ["장미"],
            "레몬향": ["레몬"],
            "서블라임 라임향": ["라임"],
            "인크레더블 레더": ["레더"],
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(self.aliases(text), expected)
        self.assertEqual(sorted(self.aliases("라임바질")), ["라임", "바질"])

    def test_long_note_names_win_over_the_short_alias(self):
        target = self.index["note_alias_target"]
        self.assertEqual(self.aliases("허니서클"), ["허니서클"])
        self.assertEqual(target["허니서클"], "honeysuckle")
        self.assertEqual(self.aliases("레몬그라스"), ["레몬그라스"])
        self.assertEqual(target["레몬그라스"], "lemongrass")

    def test_note_labels_stay_paired_with_their_note(self):
        # 말과 노트를 따로 정렬해 짝지으면 `바다` 가 basil 로 표시됐다.
        result = nlr_engine.recommend(self.index, "바질이랑 베르가못이랑 바다")
        self.assertEqual(_notes(result), {
            ("바다", "sea notes"), ("바질", "basil"), ("베르가못", "bergamot")})

    def test_demo_queries_keep_their_first_result(self):
        # exec/04_시연_시나리오.md 의 두 질의. 사전 경로의 1위를 고정한다 —
        # 운영은 ①단계가 더해져 1위가 다르지만, 사전 경로가 흔들리면 그쪽도 흔들린다.
        cases = {
            "가을에 쓸 남성적인 우드향": "Si",
            "상큼한 오렌지향이 나는 여성용 향수": "Coco Mademoiselle",
        }
        for query, first in cases.items():
            with self.subTest(query=query):
                result = nlr_engine.recommend(self.index, query)
                self.assertEqual(result["results"][0]["name"], first)

    def test_search_examples_shown_in_the_app_find_something(self):
        # 검색창이 권하는 예시는 LLM 없이도 결과가 나와야 한다.
        for query in ("상큼한 향", "풀향"):
            with self.subTest(query=query):
                result = nlr_engine.recommend(self.index, query)
                self.assertNotEqual(result["status"], "NO_CONDITION")
                self.assertTrue(result["results"])


if __name__ == "__main__":
    unittest.main()
