package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.global.i18n.Language;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import java.util.Map;

/**
 * 개인화 추천 후보의 근거를 응답에 쓸 모양으로 바꿉니다.
 *
 * <p>후보는 근거 출처를 {@code TASTE} · {@code FIT} · {@code RECENT} 로 들고 있고, 응답은
 * 취향 테스트를 {@code TASTE_TEST} 로 내보냅니다. 캐시에 저장된 값을 바꾸지 않으려고 이름을
 * 여기서만 바꿉니다.
 */
final class PersonalizedRecommendationReasons {

    static final String SOURCE_FIT = "FIT";
    static final String SOURCE_RECENT = "RECENT";
    static final String SOURCE_TASTE_TEST = "TASTE_TEST";

    /**
     * 향 계열 code 의 영어 이름입니다.
     *
     * <p>{@code scent_regions} 에는 한국어 이름({@code name})만 있어 여기 둡니다. 계열은
     * 마이그레이션이 심은 9개로 고정이고, 프론트 {@code shared/config/scentFamilies.ts} 의 키와
     * 같습니다. 모르는 code 가 오면 영어 문장을 만들지 않고 한국어 문장으로 되돌아갑니다.
     */
    private static final Map<String, String> SCENT_FAMILY_ENGLISH_NAMES = Map.of(
            "FLORAL", "Floral",
            "GREEN", "Green",
            "CITRUS", "Citrus",
            "FRUITY", "Fruity",
            "AQUATIC", "Aquatic",
            "MUSK", "Musk",
            "GOURMAND", "Gourmand",
            "WOODY", "Woody",
            "AMBER", "Amber");

    private PersonalizedRecommendationReasons() {
    }

    /** 응답의 {@code evidenceSource} 입니다. */
    static String sourceOf(PersonalizedRecommendationCandidate candidate) {
        return switch (candidate.evidenceSource()) {
            case SOURCE_FIT -> SOURCE_FIT;
            case SOURCE_RECENT -> SOURCE_RECENT;
            default -> SOURCE_TASTE_TEST;
        };
    }

    /** 응답의 {@code evidenceKey} 입니다. 어코드 근거는 키가 비어 있으면 이름을 씁니다. */
    static String keyOf(PersonalizedRecommendationCandidate candidate) {
        if (candidate.evidenceKey() != null || SOURCE_TASTE_TEST.equals(sourceOf(candidate))) {
            return candidate.evidenceKey();
        }
        return candidate.evidenceName();
    }

    /** 요청 언어로 쓴 추천 이유입니다. 영어로 쓸 재료가 없으면 한국어입니다. */
    static String reasonOf(PersonalizedRecommendationCandidate candidate, Language language) {
        if (language != null && language.isEnglish()) {
            String english = englishReasonOf(candidate);
            if (english != null) {
                return english;
            }
        }
        return koreanReasonOf(candidate);
    }

    private static String koreanReasonOf(PersonalizedRecommendationCandidate candidate) {
        return switch (sourceOf(candidate)) {
            case SOURCE_FIT -> "높게 평가한 향수와 " + candidate.evidenceName() + " 어코드가 비슷해요.";
            case SOURCE_RECENT -> "최근 살펴본 향수에서 자주 만난 "
                    + candidate.evidenceName() + " 어코드를 담고 있어요.";
            default -> "취향 테스트에서 선택한 " + candidate.evidenceName() + " 계열과 잘 맞아요.";
        };
    }

    private static String englishReasonOf(PersonalizedRecommendationCandidate candidate) {
        return switch (sourceOf(candidate)) {
            case SOURCE_FIT -> "Its " + keyOf(candidate)
                    + " accord is close to the perfumes you rated highly.";
            case SOURCE_RECENT -> "It carries the " + keyOf(candidate)
                    + " accord you've often met in perfumes you viewed recently.";
            default -> {
                String family = candidate.evidenceKey() == null
                        ? null
                        : SCENT_FAMILY_ENGLISH_NAMES.get(candidate.evidenceKey());
                yield family == null
                        ? null
                        : "It suits the " + family + " scent family you picked in the Taste Test.";
            }
        };
    }
}
