package com.hyanghae.backend.recommendation.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hyanghae.backend.global.i18n.Language;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import org.junit.jupiter.api.Test;

class PersonalizedRecommendationReasonsTest {

    @Test
    void writesFitReasonInBothLanguages() {
        var candidate = candidate("FIT", "woody", "woody");

        assertThat(PersonalizedRecommendationReasons.reasonOf(candidate, Language.KO))
                .isEqualTo("높게 평가한 향수와 woody 어코드가 비슷해요.");
        assertThat(PersonalizedRecommendationReasons.reasonOf(candidate, Language.EN))
                .isEqualTo("Its woody accord is close to the perfumes you rated highly.");
        assertThat(PersonalizedRecommendationReasons.sourceOf(candidate)).isEqualTo("FIT");
        assertThat(PersonalizedRecommendationReasons.keyOf(candidate)).isEqualTo("woody");
    }

    @Test
    void writesRecentReasonInBothLanguages() {
        var candidate = candidate("RECENT", "vanilla", "vanilla");

        assertThat(PersonalizedRecommendationReasons.reasonOf(candidate, Language.KO))
                .isEqualTo("최근 살펴본 향수에서 자주 만난 vanilla 어코드를 담고 있어요.");
        assertThat(PersonalizedRecommendationReasons.reasonOf(candidate, Language.EN))
                .isEqualTo("It carries the vanilla accord you've often met in perfumes "
                        + "you viewed recently.");
        assertThat(PersonalizedRecommendationReasons.sourceOf(candidate)).isEqualTo("RECENT");
    }

    @Test
    void writesTasteTestReasonWithScentFamilyEnglishName() {
        var candidate = candidate("TASTE", "그린·아로마틱", "GREEN");

        assertThat(PersonalizedRecommendationReasons.reasonOf(candidate, Language.KO))
                .isEqualTo("취향 테스트에서 선택한 그린·아로마틱 계열과 잘 맞아요.");
        assertThat(PersonalizedRecommendationReasons.reasonOf(candidate, Language.EN))
                .isEqualTo("It suits the Green scent family you picked in the Taste Test.");
        assertThat(PersonalizedRecommendationReasons.sourceOf(candidate)).isEqualTo("TASTE_TEST");
        assertThat(PersonalizedRecommendationReasons.keyOf(candidate)).isEqualTo("GREEN");
    }

    /** 영어 이름을 모르는 계열이면 영어 요청이어도 한국어 문장으로 되돌아갑니다. */
    @Test
    void fallsBackToKoreanWhenScentFamilyHasNoEnglishName() {
        var unknown = candidate("TASTE", "새 계열", "NEW_FAMILY");
        var missingKey = candidate("TASTE", "우디", null);

        assertThat(PersonalizedRecommendationReasons.reasonOf(unknown, Language.EN))
                .isEqualTo("취향 테스트에서 선택한 새 계열 계열과 잘 맞아요.");
        assertThat(PersonalizedRecommendationReasons.reasonOf(missingKey, Language.EN))
                .isEqualTo("취향 테스트에서 선택한 우디 계열과 잘 맞아요.");
        assertThat(PersonalizedRecommendationReasons.keyOf(missingKey)).isNull();
    }

    /** 어코드 근거는 키가 비어 있어도 이름이 곧 키입니다. */
    @Test
    void usesAccordNameWhenAccordKeyIsMissing() {
        var candidate = candidate("RECENT", "citrus", null);

        assertThat(PersonalizedRecommendationReasons.keyOf(candidate)).isEqualTo("citrus");
        assertThat(PersonalizedRecommendationReasons.reasonOf(candidate, Language.EN))
                .startsWith("It carries the citrus accord");
    }

    private static PersonalizedRecommendationCandidate candidate(
            String source,
            String evidenceName,
            String evidenceKey
    ) {
        return new PersonalizedRecommendationCandidate(
                10L, "향수", "Perfume", "향수", null, 1.0,
                source, evidenceName, evidenceKey, null);
    }
}
