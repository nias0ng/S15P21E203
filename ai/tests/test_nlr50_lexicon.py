"""레드팀(2026-10-02) 사전 조건 결함이 되살아나지 않는지 본다 — 사전 v1.19 의 1b · 1e · 1f.

    python -m unittest discover -s ai/tests

사전 경로(`structured=None`)와 ①단계 출력을 넣는 **운영 경로**(`structured`) 둘 다 본다.
운영 경로 사례의 `structured` 는 레드팀 사례 파일(team1·team3)에 저장된 ①단계 출력이다.
인덱스를 한 번만 만든다 — 13만 x 92 행렬이라 테스트마다 만들면 수십 초가 걸린다.
"""
import logging
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nlr_engine  # noqa: E402


def _structured(additional=(), scent=(), avoid=(), gender=()):
    """①단계 출력 모양의 dict. dict."""
    return {"scent_preference": list(scent),
            "context": {"season": [], "daypart": [], "gender": list(gender)},
            "performance": {"intensity": "", "longevity": ""},
            "avoid": list(avoid), "additional_requirements": list(additional)}


class LexiconV119Test(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def core(self, text, structured=None):
        return set(nlr_engine.recommend(self.index, text, structured=structured)["conditions"]["core"])

    # 1b — `물` 한 글자가 `선물` 안에서 aquatic 을 걸던 것
    def test_gift_does_not_mean_water(self):
        cases = [
            ("깔끔한 향수 선물 추천해줘", _structured(["깔끔한 향수", "선물용"])),
            ("엄마 선물로 단정한 향수", _structured(["엄마 선물", "단정한 향수"])),
        ]
        for text, structured in cases:
            for s in (None, structured):
                with self.subTest(text=text, structured=s is not None):
                    self.assertNotIn("aquatic", self.core(text, s))

    def test_water_words_still_mean_water(self):
        # 물 문맥 합성어와 다른 조건 낱말(바다·시원 …)은 그대로 aquatic 이다
        cases = [
            ("물놀이 갈 때 쓸 깔끔한 향", _structured(["물놀이 갈 때 쓸 깔끔한 향"])),
            ("바닷물처럼 시원하고 깨끗한 향", _structured(["바닷물처럼 시원하고 깨끗한 향"])),
            ("바다 같은 깨끗한 향", None),
        ]
        for text, structured in cases:
            with self.subTest(text=text):
                self.assertIn("aquatic", self.core(text, structured))

    # 1e — 붙여 쓴 `숲속` 이 woody 하나로만 읽히던 것
    def test_forest_written_without_space(self):
        joined = self.core("숲속에 있는 느낌", _structured(["숲속에 있는 느낌"]))
        spaced = self.core("숲 속에 있는 느낌", _structured(["숲 속에 있는 느낌"]))
        self.assertEqual(joined, {"earthy", "mossy", "woody"})
        self.assertEqual(joined, spaced)
        self.assertEqual(self.core("숲속 같은 향"), {"earthy", "mossy", "woody"})

    # 1e — `비누향` 이 사전 표면형이 아니라 조건이 0개이던 것
    def test_soap_scent_is_soapy(self):
        cases = [
            ("비누향", _structured(["비누향"])),
            ("남자친구 선물로 비누향 나는 향수",
             _structured(["남자친구 선물"], scent=["soap"], gender=["male"])),
            ("비누 냄새 나는 향수", None),
        ]
        for text, structured in cases:
            with self.subTest(text=text):
                self.assertTrue({"soapy", "fresh"} <= self.core(text, structured))

    def test_clean_soap_unchanged(self):
        # 깨끗한+비누 갈래(kr.ctx.clean)가 이미 내던 조건과 같다
        self.assertEqual(self.core("깨끗한비누향", _structured(["깨끗한 비누향"])), {"fresh", "soapy"})

    # 1f — `달달` 한 마디가 caramel 을 필수 조건으로 만들던 것
    def test_sweet_does_not_require_caramel(self):
        cases = [
            ("달달한 향", _structured(["달달한 향"])),
            ("달달한 바닐라 향", _structured(["달달한"], scent=["Vanilla"])),
            ("달콤한 향수", None),
        ]
        for text, structured in cases:
            with self.subTest(text=text):
                core = self.core(text, structured)
                self.assertIn("sweet", core)
                self.assertNotIn("caramel", core)

    def test_caramel_word_still_means_caramel(self):
        # `캐러멜` 은 노트 별칭(캐러멜 -> caramel) 브리지로 caramel 을 그대로 만든다
        for structured in (None, _structured(["캐러멜 향"])):
            with self.subTest(structured=structured is not None):
                self.assertIn("caramel", self.core("캐러멜 향 나는 향수", structured))

    # 1-15 — 사전 표면형이 바뀌면 보호 낱말을 다시 만들어야 한다
    def test_lexicon_and_protected_words_share_a_version(self):
        lexicon = nlr_engine.lexicon_version(nlr_engine.DEFAULT_LEXICON)
        words = nlr_engine.DEFAULT_PROTECTED_WORDS.stem.replace("protected_words_", "")
        self.assertEqual(lexicon, words)

    def test_real_words_near_new_forms_are_not_corrected(self):
        # 새 표면형 `비누`·`숲속` 과 자모 거리 1 인 진짜 낱말. 목록을 다시 만들지 않으면
        # `비녀 -> 비누` · `수속 -> 숲속` 으로 바뀐다(v1.18 목록으로 확인)
        for text in ("비녀 꽂은 날 쓸 향", "비수 같은 날카로운 향", "수속 밟고 출국할 때 쓸 향"):
            with self.subTest(text=text):
                _, verdict, corrections = nlr_engine.typo_gate(self.index, _structured([text]))
                self.assertEqual((verdict, corrections), ("그대로", []))


if __name__ == "__main__":
    unittest.main()
