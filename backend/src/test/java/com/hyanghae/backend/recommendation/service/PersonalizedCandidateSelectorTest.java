package com.hyanghae.backend.recommendation.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class PersonalizedCandidateSelectorTest {

    private final PersonalizedCandidateSelector selector = new PersonalizedCandidateSelector();

    @Test
    void choosesByScoreWeight() {
        List<PersonalizedRecommendationCandidate> candidates = List.of(
                candidate(1L, 0.8, null),
                candidate(2L, 0.2, null));

        assertThat(selector.weightedRandom(candidates, 0.0).perfumeId()).isEqualTo(1L);
        assertThat(selector.weightedRandom(candidates, 0.79).perfumeId()).isEqualTo(1L);
        assertThat(selector.weightedRandom(candidates, 0.81).perfumeId()).isEqualTo(2L);
    }

    @Test
    void excludesRecentCandidatesTemporarily() {
        OffsetDateTime now = OffsetDateTime.parse("2026-09-16T00:00:00Z");
        PersonalizedRecommendationCandidate recent = candidate(1L, 100.0, now.minusDays(1));
        PersonalizedRecommendationCandidate available = candidate(2L, 1.0, now.minusDays(4));

        assertThat(selector.select(List.of(recent, available), now.minusDays(3)).perfumeId())
                .isEqualTo(2L);
    }

    @Test
    void reopensTheOldestCandidateWhenAllAreInCooldown() {
        OffsetDateTime now = OffsetDateTime.parse("2026-09-16T00:00:00Z");
        PersonalizedRecommendationCandidate oldest = candidate(1L, 1.0, now.minusDays(2));
        PersonalizedRecommendationCandidate newest = candidate(2L, 100.0, now.minusDays(1));

        assertThat(selector.select(List.of(newest, oldest), now.minusDays(3)).perfumeId())
                .isEqualTo(1L);
    }

    private PersonalizedRecommendationCandidate candidate(
            Long perfumeId,
            double score,
            OffsetDateTime lastRecommendedAt
    ) {
        return new PersonalizedRecommendationCandidate(
                perfumeId,
                "향수 " + perfumeId,
                "Perfume " + perfumeId,
                "향수 " + perfumeId,
                null,
                score,
                "TASTE",
                "우디",
                "WOODY",
                lastRecommendedAt);
    }
}
