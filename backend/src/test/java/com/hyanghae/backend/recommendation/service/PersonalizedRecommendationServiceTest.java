package com.hyanghae.backend.recommendation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.config.PersonalizedRecommendationProperties;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import com.hyanghae.backend.recommendation.service.PersonalizedRecommendationCacheInspector.CacheSnapshot;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PersonalizedRecommendationServiceTest {

    private static final long USER_ID = 1L;

    @Mock
    private PersonalizedRecommendationRepository recommendationRepository;

    @Mock
    private PersonalizedCandidateSelector candidateSelector;

    @Mock
    private PersonalizedRecommendationCacheInspector cacheInspector;

    @Mock
    private PersonalizedRecommendationRefresher refresher;

    @Mock
    private CurrentUser currentUser;

    private PersonalizedRecommendationService service;

    @BeforeEach
    void setUp() {
        service = new PersonalizedRecommendationService(
                recommendationRepository,
                cacheInspector,
                refresher,
                candidateSelector,
                new PersonalizedRecommendationProperties(
                        10,
                        Duration.ofHours(24),
                        Duration.ofMinutes(10)),
                currentUser);
    }

    @Test
    void requiresCompletedTasteTestBeforeFindingCandidates() {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(recommendationRepository.hasTasteProfile(USER_ID)).thenReturn(false);

        assertThatThrownBy(service::recommend)
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(RecommendationErrorCode.RECOMMENDATION_TASTE_TEST_REQUIRED));

        verify(recommendationRepository).hasTasteProfile(USER_ID);
        verifyNoMoreInteractions(recommendationRepository, candidateSelector);
    }

    @Test
    void reusesValidCandidatesWithoutRefreshing() {
        PersonalizedRecommendationCandidate candidate = candidate();
        prepareAuthenticatedUser();
        when(cacheInspector.inspect(eq(USER_ID), any()))
                .thenReturn(new CacheSnapshot(false, false, List.of(candidate)));
        when(candidateSelector.select(eq(List.of(candidate)), any())).thenReturn(candidate);

        var response = service.recommend();

        assertThat(response.recommendation().perfumeId()).isEqualTo(candidate.perfumeId());
        assertThat(response.recommendationToken()).isNotNull();
        verifyNoMoreInteractions(refresher);
        verify(recommendationRepository).saveOffer(
                eq(response.recommendationToken()),
                eq(USER_ID),
                eq(candidate.perfumeId()),
                any(),
                any());
    }

    @Test
    void returnsRefreshInProgressImmediatelyEvenWhenStaleCandidatesExist() {
        PersonalizedRecommendationCandidate candidate = candidate();
        prepareAuthenticatedUser();
        CacheSnapshot stale = new CacheSnapshot(true, false, List.of(candidate));
        when(cacheInspector.inspect(eq(USER_ID), any())).thenReturn(stale);
        when(refresher.refresh(eq(USER_ID), any())).thenThrow(new BusinessException(
                RecommendationErrorCode.RECOMMENDATION_REFRESH_IN_PROGRESS));

        assertThatThrownBy(service::recommend)
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(RecommendationErrorCode.RECOMMENDATION_REFRESH_IN_PROGRESS));
    }

    @Test
    void reusesStaleCandidatesWhenRefreshFails() {
        PersonalizedRecommendationCandidate candidate = candidate();
        prepareAuthenticatedUser();
        CacheSnapshot stale = new CacheSnapshot(true, false, List.of(candidate));
        when(cacheInspector.inspect(eq(USER_ID), any())).thenReturn(stale);
        when(refresher.refresh(eq(USER_ID), any())).thenThrow(new IllegalStateException("db"));
        when(recommendationRepository.findCachedCandidates(USER_ID))
                .thenReturn(List.of(candidate));
        when(candidateSelector.select(eq(List.of(candidate)), any())).thenReturn(candidate);

        var response = service.recommend();

        assertThat(response.recommendation().perfumeId()).isEqualTo(candidate.perfumeId());
    }

    @Test
    void returnsServiceUnavailableWhenRefreshFailsWithoutStaleCandidates() {
        prepareAuthenticatedUser();
        CacheSnapshot stale = new CacheSnapshot(true, false, List.of());
        when(cacheInspector.inspect(eq(USER_ID), any())).thenReturn(stale);
        when(refresher.refresh(eq(USER_ID), any())).thenThrow(new IllegalStateException("db"));

        assertThatThrownBy(service::recommend)
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(RecommendationErrorCode.RECOMMENDATION_REFRESH_FAILED));
    }

    @Test
    void returnsNotFoundForValidEmptyResult() {
        prepareAuthenticatedUser();
        when(cacheInspector.inspect(eq(USER_ID), any()))
                .thenReturn(new CacheSnapshot(false, true, List.of()));

        assertThatThrownBy(service::recommend)
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(RecommendationErrorCode.RECOMMENDATION_NOT_FOUND));
        verifyNoMoreInteractions(refresher, candidateSelector);
    }

    private void prepareAuthenticatedUser() {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(recommendationRepository.hasTasteProfile(USER_ID)).thenReturn(true);
    }

    private PersonalizedRecommendationCandidate candidate() {
        return new PersonalizedRecommendationCandidate(
                10L,
                "향수",
                null,
                1.0,
                "TASTE",
                "우디",
                null);
    }
}
