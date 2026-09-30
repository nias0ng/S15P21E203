package com.hyanghae.backend.recommendation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import com.hyanghae.backend.recommendation.service.PersonalizedRecommendationCacheInspector.CacheSnapshot;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PersonalizedRecommendationRefresherTest {

    private static final long USER_ID = 1L;
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-09-23T00:00:00Z");

    @Mock
    private PersonalizedRecommendationRepository repository;

    @Mock
    private PersonalizedRecommendationCacheInspector inspector;

    private PersonalizedRecommendationRefresher refresher;

    @BeforeEach
    void setUp() {
        refresher = new PersonalizedRecommendationRefresher(repository, inspector);
    }

    @Test
    void failsImmediatelyWhenAnotherRequestOwnsTheLock() {
        when(repository.tryLockForUser(USER_ID)).thenReturn(false);

        assertThatThrownBy(() -> refresher.refresh(USER_ID, NOW))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(RecommendationErrorCode.RECOMMENDATION_REFRESH_IN_PROGRESS));
        verify(repository, never()).findTopCandidates(USER_ID, 10);
    }

    @Test
    void rechecksAfterLockAndCalculatesOnlyWhenStillRequired() {
        PersonalizedRecommendationCandidate candidate = new PersonalizedRecommendationCandidate(
                10L, "향수", "Perfume", "향수", null, 1.0, "TASTE", "우디", "WOODY", null);
        when(repository.tryLockForUser(USER_ID)).thenReturn(true);
        when(inspector.inspect(USER_ID, NOW))
                .thenReturn(new CacheSnapshot(true, false, List.of()));
        when(repository.ensureCacheStateAndGetSourceVersion(USER_ID)).thenReturn(3L);
        when(repository.findMaxViewId(USER_ID)).thenReturn(77L);
        when(repository.findTopCandidates(USER_ID, 10)).thenReturn(List.of(candidate));

        var result = refresher.refresh(USER_ID, NOW);

        assertThat(result.candidates()).containsExactly(candidate);
        verify(repository).replaceCache(USER_ID, List.of(candidate), 3L, 77L, NOW);
    }

    @Test
    void usesCacheFilledByPreviousRequestAfterAcquiringLock() {
        CacheSnapshot ready = new CacheSnapshot(false, false, List.of());
        when(repository.tryLockForUser(USER_ID)).thenReturn(true);
        when(inspector.inspect(USER_ID, NOW)).thenReturn(ready);

        assertThat(refresher.refresh(USER_ID, NOW)).isSameAs(ready);
        verify(repository, never()).findTopCandidates(USER_ID, 10);
    }
}
