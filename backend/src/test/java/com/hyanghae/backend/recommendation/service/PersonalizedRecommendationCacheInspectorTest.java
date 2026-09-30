package com.hyanghae.backend.recommendation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.recommendation.config.PersonalizedRecommendationProperties;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCacheState;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PersonalizedRecommendationCacheInspectorTest {

    private static final long USER_ID = 1L;
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-09-23T00:00:00Z");

    @Mock
    private PersonalizedRecommendationRepository repository;

    private PersonalizedRecommendationCacheInspector inspector;

    @BeforeEach
    void setUp() {
        inspector = new PersonalizedRecommendationCacheInspector(
                repository,
                new PersonalizedRecommendationProperties(
                        10,
                        Duration.ofHours(24),
                        Duration.ofMinutes(10)));
    }

    @Test
    void refreshesWhenSourceVersionChanged() {
        when(repository.findCacheState(USER_ID)).thenReturn(Optional.of(
                state(2, 1L, NOW.minusHours(1), "READY")));
        when(repository.findCachedCandidates(USER_ID)).thenReturn(List.of(candidate()));

        assertThat(inspector.inspect(USER_ID, NOW).refreshRequired()).isTrue();
    }

    @Test
    void keepsEmptyResultUntilRefreshConditionOccurs() {
        when(repository.findCacheState(USER_ID)).thenReturn(Optional.of(
                state(1, 1L, NOW.minusHours(1), "EMPTY")));
        when(repository.findCachedCandidates(USER_ID)).thenReturn(List.of());
        when(repository.hasViewThresholdAfter(USER_ID, 100, 10)).thenReturn(false);

        var result = inspector.inspect(USER_ID, NOW);

        assertThat(result.refreshRequired()).isFalse();
        assertThat(result.emptyResult()).isTrue();
    }

    @Test
    void refreshesAtTheTwentyFourHourBoundary() {
        when(repository.findCacheState(USER_ID)).thenReturn(Optional.of(
                state(1, 1L, NOW.minusHours(24), "READY")));
        when(repository.findCachedCandidates(USER_ID)).thenReturn(List.of(candidate()));

        assertThat(inspector.inspect(USER_ID, NOW).refreshRequired()).isTrue();
    }

    @Test
    void refreshesWhenTenViewsAccumulated() {
        when(repository.findCacheState(USER_ID)).thenReturn(Optional.of(
                state(1, 1L, NOW.minusHours(1), "READY")));
        when(repository.findCachedCandidates(USER_ID)).thenReturn(List.of(candidate()));
        when(repository.hasViewThresholdAfter(USER_ID, 100, 10)).thenReturn(true);

        assertThat(inspector.inspect(USER_ID, NOW).refreshRequired()).isTrue();
    }

    @Test
    void refreshesReadyStateWhenEveryCandidateBecameUnavailable() {
        when(repository.findCacheState(USER_ID)).thenReturn(Optional.of(
                state(1, 1L, NOW.minusHours(1), "READY")));
        when(repository.findCachedCandidates(USER_ID)).thenReturn(List.of());
        when(repository.hasViewThresholdAfter(USER_ID, 100, 10)).thenReturn(false);

        assertThat(inspector.inspect(USER_ID, NOW).refreshRequired()).isTrue();
    }

    private PersonalizedRecommendationCacheState state(
            long sourceVersion,
            Long calculatedSourceVersion,
            OffsetDateTime calculatedAt,
            String status
    ) {
        return new PersonalizedRecommendationCacheState(
                sourceVersion,
                calculatedSourceVersion,
                100,
                calculatedAt,
                status);
    }

    private PersonalizedRecommendationCandidate candidate() {
        return new PersonalizedRecommendationCandidate(
                10L, "향수", "Perfume", "향수", null, 1.0, "TASTE", "우디", "WOODY", null);
    }
}
