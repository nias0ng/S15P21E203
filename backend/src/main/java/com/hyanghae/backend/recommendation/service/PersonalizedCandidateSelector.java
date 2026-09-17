package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Component;

/** 최근 노출을 피하면서 점수에 비례해 후보 하나를 고릅니다. */
@Component
public class PersonalizedCandidateSelector {

    public PersonalizedRecommendationCandidate select(
            List<PersonalizedRecommendationCandidate> candidates,
            OffsetDateTime cooldownStartedAt
    ) {
        List<PersonalizedRecommendationCandidate> available = candidates.stream()
                .filter(candidate -> candidate.lastRecommendedAt() == null
                        || candidate.lastRecommendedAt().isBefore(cooldownStartedAt))
                .toList();

        if (!available.isEmpty()) {
            return weightedRandom(available, ThreadLocalRandom.current().nextDouble());
        }

        // 상위 후보를 모두 최근에 보여 줬다면 영구 제외하지 않고 가장 오래된 것부터 다시 엽니다.
        return candidates.stream()
                .min(Comparator.comparing(PersonalizedRecommendationCandidate::lastRecommendedAt)
                        .thenComparing(PersonalizedRecommendationCandidate::perfumeId))
                .orElseThrow();
    }

    /** 테스트가 경계값을 직접 줄 수 있도록 난수를 0 이상 1 미만 비율로 받습니다. */
    PersonalizedRecommendationCandidate weightedRandom(
            List<PersonalizedRecommendationCandidate> candidates,
            double randomRatio
    ) {
        double total = candidates.stream()
                .mapToDouble(PersonalizedRecommendationCandidate::score)
                .sum();
        double cursor = total * randomRatio;

        for (PersonalizedRecommendationCandidate candidate : candidates) {
            cursor -= candidate.score();
            if (cursor < 0.0) {
                return candidate;
            }
        }
        return candidates.getLast();
    }
}
