"""①단계(LLM) 출력을 그대로 믿지 않는지 본다 — 레드팀 2026-10-02 1-10.

    python -m unittest discover -s tests

GMS 를 부르지 않는다. ①단계 응답은 가짜 dict · 가짜 응답 문자열로 넣는다.
"""
import copy
import json
import logging
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import llm_stage1  # noqa: E402
import nlr_engine  # noqa: E402


def _stage1(**fields):
    """①단계 출력 모양의 dict. 안 준 칸은 비어 있다."""
    value = copy.deepcopy(llm_stage1.EMPTY_STAGE1)
    value.update(fields)
    return value


def _fake_post(content):
    """GMS 대신 `content` 를 본문으로 돌려주는 함수."""
    def post(url, payload, api_key, timeout):
        return {"choices": [{"message": {"content": content}}]}
    return post


class AdditionalGroundingTest(unittest.TestCase):
    """`additional_requirements` 에서만 잡힌 표면형은 core 가 되지 않는다."""

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.INFO)
        cls.index = nlr_engine.load_index()

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def recommend(self, text, structured, estimator=None):
        return nlr_engine.recommend(self.index, text, structured=structured, estimator=estimator)

    def test_made_up_additional_makes_no_condition(self):
        # 레드팀 팀4 t4-29. 전에는 core 5개에 화면이 "요청하신 바닐라 …" 였다.
        calls = []

        def estimator(raw_text, expressions):
            calls.append(expressions)
            return {}

        result = self.recommend("아무거나 추천해줘", _stage1(
            additional_requirements=["바닐라 향", "달콤한 향", "머스크"]), estimator)
        self.assertEqual(result["conditions"]["core"], [])
        self.assertEqual(result["status"], "NO_CONDITION")
        # 버린 조각이 미매칭으로 남으면 ⑤단계가 그것을 다시 해석한다 — 부르지 않아야 한다
        self.assertEqual(result["unmatched"], [])
        self.assertEqual(calls, [])

    def test_made_up_note_alias_makes_no_condition(self):
        result = self.recommend("아무거나 추천해줘", _stage1(additional_requirements=["무화과 향"]))
        self.assertEqual(result["conditions"]["core"], [])

    def test_additional_that_the_user_wrote_still_counts(self):
        result = self.recommend("바닐라 향 나는 거", _stage1(additional_requirements=["바닐라 향"]))
        self.assertIn("vanilla", result["conditions"]["core"])

    def test_from_is_the_word_the_user_wrote(self):
        # ①단계가 `화이트 머스크` 로 늘려 썼어도 화면에는 사용자가 쓴 `머스크` 가 나간다
        understood = nlr_engine.understand(self.index, "머스크 좋아",
                                           _stage1(additional_requirements=["화이트 머스크"]))
        musky = [e["from"] for e in understood["evidence"] if e["accord"] == "musky"]
        self.assertTrue(musky)
        self.assertEqual(set(musky), {"머스크"})

    def test_spacing_case_and_normalization_are_ignored(self):
        self.assertTrue(nlr_engine._form_in_text(self.index, "화이트머스크 좋아", "화이트 머스크"))
        self.assertTrue(nlr_engine._form_in_text(self.index, "CLEAN 한 느낌", "clean"))
        decomposed = "바닐라"     # 바닐라 (NFD)
        self.assertTrue(nlr_engine._form_in_text(self.index, decomposed, "바닐라"))
        self.assertFalse(nlr_engine._form_in_text(self.index, "아무거나 추천해줘", "바닐라"))

    def test_rewritten_ending_counts(self):
        # ①단계가 `달콤했으면` 을 `달콤한` 으로 바꿔 쓴다 (합성 B-28-3 등).
        result = self.recommend("살짝 달콤했으면 해", _stage1(additional_requirements=["살짝 달콤한 느낌"]))
        self.assertIn("sweet", result["conditions"]["core"])
        # 같은 조각이라도 원문에 그 말이 없으면 안 된다
        result = self.recommend("아무거나 추천해줘", _stage1(additional_requirements=["살짝 달콤한 느낌"]))
        self.assertNotIn("sweet", result["conditions"]["core"])

    def test_two_letter_forms_need_the_exact_word(self):
        # 끝 글자 규칙은 3글자 이상만. `달달` 의 앞 글자 `달` 은 근거가 아니다
        self.assertFalse(nlr_engine._form_in_text(self.index, "달아요", "달달"))

    def test_typo_fix_counts(self):
        # ①단계가 `상큼항` 을 `상큼한` 으로 고쳐 준다 [측정 기록 25번]
        self.assertTrue(nlr_engine._form_in_text(self.index, "상큼항 향수 추천해줘", "상큼한"))

    def test_protected_word_typo_fix_is_lost(self):
        # **이 판은 잃는다** — `빨레` 는 보호 낱말이라 검문소도 안 고친다 (77번 체크포인트)
        result = self.recommend("빨레 냄새 나는 향수 찾아줘", _stage1(additional_requirements=["빨래 냄새 나는 향수"]))
        self.assertNotIn("soapy", result["conditions"]["core"])


class Stage1LimitTest(unittest.TestCase):
    """`validate()` 가 조각 개수 · 길이 상한을 지킨다 (목록당 10개 · 조각당 200자)."""

    @classmethod
    def setUpClass(cls):
        logging.disable(logging.WARNING)

    @classmethod
    def tearDownClass(cls):
        logging.disable(logging.NOTSET)

    def check(self, value):
        return llm_stage1.validate(llm_stage1.parse_content(json.dumps(value, ensure_ascii=False)))

    def test_real_maximum_passes_unchanged(self):
        # 저장본 1,303건의 최대가 8개 · 96자다
        value = _stage1(additional_requirements=["가" * 96] * 8, scent_preference=["Vanilla"])
        self.assertEqual(self.check(value), value)

    def test_limits_are_inclusive(self):
        value = _stage1(additional_requirements=["가" * 200] * 10, avoid=["나"] * 10)
        self.assertEqual(self.check(value), value)

    def test_too_many_pieces_keep_the_first_ten(self):
        pieces = [f"조각 {i}" for i in range(15)]
        out = self.check(_stage1(additional_requirements=pieces, avoid=pieces))
        self.assertEqual(out["additional_requirements"], pieces[:10])
        self.assertEqual(out["avoid"], pieces[:10])

    def test_long_piece_is_cut_to_200_characters(self):
        # 레드팀 팀6 #8 의 269자 조각. DB 칸이 VARCHAR(255) 다
        long_piece = "바닐라 " + "가" * 265
        self.assertEqual(len(long_piece), 269)
        value = _stage1(additional_requirements=["시트러스 향", long_piece],
                        context={"season": ["summer"], "daypart": [], "gender": []})
        out = self.check(value)
        self.assertEqual(out["additional_requirements"], ["시트러스 향", long_piece[:200]])
        self.assertEqual(out["context"], value["context"])          # 다른 칸은 그대로다

    def test_input_is_not_changed(self):
        value = _stage1(additional_requirements=["가" * 300] * 12)
        before = copy.deepcopy(value)
        llm_stage1.validate(value)
        self.assertEqual(value, before)

    def test_type_errors_still_reject(self):
        with self.assertRaises(llm_stage1.Stage1Error) as caught:
            self.check(_stage1(additional_requirements=["가", 3]))
        self.assertEqual(caught.exception.code, "SCHEMA_VALIDATION_ERROR")

    def test_structure_trims_a_fake_gms_answer(self):
        content = "```json\n" + json.dumps(
            _stage1(additional_requirements=["가" * 269] + ["나"] * 11), ensure_ascii=False) + "\n```"
        with mock.patch.dict(os.environ, {"GMS_API_KEY": "test-only"}):
            out = llm_stage1.structure("아무 문장", post=_fake_post(content))
        self.assertIsNotNone(out)
        self.assertEqual(len(out["additional_requirements"]), 10)
        self.assertTrue(all(len(p) <= 200 for p in out["additional_requirements"]))


if __name__ == "__main__":
    unittest.main()
