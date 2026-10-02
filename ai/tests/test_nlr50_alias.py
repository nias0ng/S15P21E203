"""레드팀 2026-10-02 1-2 · 1-6 — 별칭 오탐 · 한국어 accord 음차 · 빠진 노트 별칭이 되살아나지 않는지 본다.

    python -m unittest discover -s ai/tests

LLM(①단계)은 부르지 않는다. **운영 경로는 ①단계 출력을 `structured` 로 손으로 넣어 본다** —
사전 경로(`structured=None`)만 보면 `_grounded` 가 ①단계 조각을 버리는 문제(1-6)가 안 보인다.
인덱스는 한 번만 만든다.
"""
import logging
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nlr_engine  # noqa: E402


def _structured(scent=(), additional=(), avoid=()):
    """①단계 출력 모양. dict."""
    return {"scent_preference": list(scent),
            "context": {"season": [], "daypart": [], "gender": []},
            "performance": {"intensity": "", "longevity": ""},
            "avoid": list(avoid), "additional_requirements": list(additional)}


def _notes(result):
    return {m["value"] for m in result["matched_data"] if m["field"] == "note"}


class AliasBlocklistTest(unittest.TestCase):
    """1a — 별칭을 품은 다른 낱말."""

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def aliases(self, text):
        return nlr_engine._longest_alias_ko(self.index, text)

    def test_blocked_words_hide_the_alias_inside(self):
        for text in ("리치한 느낌", "리치하고 고급스러운", "데이타임에", "티타임에", "올타임 데일리",
                     "페어로 쓸", "스피치 발표날", "할리우드 배우", "로즈골드 케이스",
                     "사과의 의미로", "사과하려고"):
            with self.subTest(text=text):
                self.assertEqual(self.aliases(text), [])

    def test_real_notes_are_still_found(self):
        # 정당한 쓰임 — 회귀 세트 keep 과 같은 말이다
        cases = {
            "사과 향 나는 상큼한 향수": ["사과"],
            "사과의 달콤함": ["사과"],          # `사과의` 가 아니라 `사과의 의미` 를 가린다
            "타임이랑 로즈마리": ["로즈마리", "타임"],
            "리치 과일 향": ["리치"],
            "로즈 향": ["로즈"],
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(sorted(self.aliases(text)), sorted(expected))

    def test_operational_path_drops_the_misread_condition(self):
        # ①단계가 낱말을 그대로 옮긴 경우와 바꿔 쓴 경우 둘 다 본다 (회귀 세트 t1-24 · t1-24b)
        for extra in (["리치한 느낌"], ["풍성한 느낌"]):
            with self.subTest(extra=extra):
                result = nlr_engine.recommend(self.index, "리치한 느낌의 향",
                                              structured=_structured(additional=extra))
                self.assertFalse({"rose", "fruity"} & set(result["conditions"]["core"]))
                self.assertNotIn("litchi", _notes(result))
                # 조건이 빠지면 검문소가 돈다. 가린 낱말을 사전 표면형으로 고치면 안 된다
                self.assertNotEqual(result["typo_verdict"], "교정")
        result = nlr_engine.recommend(self.index, "티타임에 어울리는 향",
                                      structured=_structured(additional=["티타임에 어울리는"]))
        self.assertNotIn("thyme", _notes(result))
        self.assertFalse({"aromatic", "fresh spicy"} & set(result["conditions"]["core"]))

    def test_operational_path_keeps_the_real_note(self):
        result = nlr_engine.recommend(self.index, "타임이랑 로즈마리 들어간 허브 향",
                                      structured=_structured(scent=["Thyme", "Rosemary"]))
        self.assertIn("thyme", _notes(result))


class KoreanAccordTest(unittest.TestCase):
    """1c — 한국어 accord 음차."""

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def test_every_target_accord_exists(self):
        missing = {k: v for k, v in nlr_engine.KOREAN_ACCORD.items() if v not in self.index["aidx"]}
        self.assertEqual(missing, {})

    def test_operational_path_keeps_the_llm_accord(self):
        # ①단계가 영어로 옳게 바꿔 넣어도 원문 근거가 없다며 버려 0건이던 문장들
        cases = [
            ("프레쉬한 향", ["fresh"], [], "fresh"),
            ("플로랄한 향", ["floral"], [], "floral"),
            ("씨트러스 향", ["citrus"], [], "citrus"),
            ("여름 밤에 쓸 아쿠아틱 향", ["aquatic"], ["아쿠아틱 향"], "aquatic"),
            ("씨솔트 들어간 솔티한 마린 향", ["Sea Salt", "marine", "salty"], ["솔티한 마린 향"], "salty"),
            ("무화과 잎 그린한 향", ["Fig Leaf", "green"], ["그린한 향"], "green"),
        ]
        for text, scent, extra, accord in cases:
            with self.subTest(text=text):
                result = nlr_engine.recommend(self.index, text,
                                              structured=_structured(scent=scent, additional=extra))
                self.assertIn(accord, result["conditions"]["core"])
                self.assertTrue(result["results"])

    def test_lexicon_path_finds_the_accord(self):
        for text, accord in (("스모키한 향", "smoky"), ("얼씨한 향", "earthy"), ("오존 느낌", "ozonic"),
                             ("애니멀릭한 향", "animalic"), ("화이트 플로럴 향수", "white floral")):
            with self.subTest(text=text):
                self.assertIn(accord, nlr_engine.recommend(self.index, text)["conditions"]["core"])

    def test_blocked_leather_word_stays_blocked(self):
        # `레더` 를 여기 넣으면 차단 목록의 `인크레더블` 이 이 경로로 다시 leather 가 된다
        result = nlr_engine.recommend(self.index, "인크레더블 같은 향수")
        self.assertNotIn("leather", result["conditions"]["core"])
        # 레더를 말하면 노트 별칭이 그대로 leather 를 만든다
        self.assertIn("leather", nlr_engine.recommend(self.index, "레더 향 나는 향수")["conditions"]["core"])

    def test_disliked_spicy_does_not_become_a_condition(self):
        # 설문 SQ0042 · SQ0073 — `스파이시` 를 넣으면 싫다고 한 향이 조건이 된다
        result = nlr_engine.recommend(
            self.index, "플로럴 향도 조금 섞였으면 좋겠어. 너무 스파이시한거는 불호이고",
            structured=_structured(scent=["floral"], avoid=["too spicy"]))
        self.assertFalse({"warm spicy", "fresh spicy"} & set(result["conditions"]["core"]))


class NoteAliasTest(unittest.TestCase):
    """1d — 빠진 노트 별칭."""

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def target(self, text):
        hit = nlr_engine._longest_alias_ko(self.index, text)
        return sorted(self.index["note_alias_target"].get(a, a) for a in hit)

    def test_new_aliases_point_to_catalog_notes(self):
        cases = {
            "앰브록산": ["ambroxan"], "암브록산": ["ambroxan"],
            "이소 E 슈퍼": ["iso e super"], "이소E슈퍼": ["iso e super"], "이소 e슈퍼": ["iso e super"],
            "헤디온": ["hedione"],
            "캐시미어우드": ["cashmere wood"], "캐시미어 우드": ["cashmere wood"],
            "무화과 잎": ["fig leaf"], "무화과잎": ["fig leaf"], "무화과": ["fig"],
            "녹차": ["green tea"], "홍차": ["tea"],
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(self.target(text), expected)
        # 별칭이 가리키는 이름은 카탈로그에 실제로 있어야 note_rows 가 향수를 찾는다
        for alias, note in self.index["note_alias_target"].items():
            with self.subTest(alias=alias):
                self.assertTrue(any(note in n for n in self.index["notes"]), note)

    def test_operational_path_uses_the_note(self):
        cases = [
            ("앰브록산 계열인데 덜 달게", ["Ambroxan"], ["앰브록산 계열", "덜 달게"], "ambroxan"),
            ("이소 E 슈퍼 들어간 투명한 우디", ["Iso E Super", "woody"], ["투명한 느낌"], "iso e super"),
            ("헤디온 들어간 투명한 자스민", ["Hedione", "Jasmine"], ["투명한 느낌"], "hedione"),
            ("녹차 향 나는 향수", ["Green Tea"], ["녹차 향"], "green tea"),
        ]
        for text, scent, extra, note in cases:
            with self.subTest(text=text):
                result = nlr_engine.recommend(self.index, text,
                                              structured=_structured(scent=scent, additional=extra))
                self.assertIn(note, _notes(result))

    def test_avoided_new_alias_is_not_a_condition(self):
        # 새 별칭도 회피 가드를 지난다 — `이소 E 슈퍼는 싫어` 가 노트 조건이 되면 안 된다
        result = nlr_engine.recommend(
            self.index, "우디 앰버 좋아하는데 이소 E 슈퍼는 싫어",
            structured=_structured(scent=["woody", "amber"], avoid=["Iso E Super"]))
        self.assertNotIn("iso e super", _notes(result))


if __name__ == "__main__":
    unittest.main()
