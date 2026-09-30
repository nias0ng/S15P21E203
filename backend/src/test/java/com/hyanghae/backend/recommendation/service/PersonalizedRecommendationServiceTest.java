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
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.i18n.LocaleContextHolder;

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

    @AfterEach
    void resetLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    /** 한국어 요청은 예전 응답 그대로에 원래 이름 · 근거 키만 더해 나갑니다. */
    @Test
    void returnsKoreanReasonWithLanguageNeutralEvidence() {
        LocaleContextHolder.setLocale(Locale.KOREAN);
        PersonalizedRecommendationCandidate candidate = candidate();
        prepareAuthenticatedUser();
        when(cacheInspector.inspect(eq(USER_ID), any()))
                .thenReturn(new CacheSnapshot(false, false, List.of(candidate)));
        when(candidateSelector.select(eq(List.of(candidate)), any())).thenReturn(candidate);

        var perfume = service.recommend().recommendation();

        assertThat(perfume.name()).isEqualTo("향수");
        assertThat(perfume.reason()).isEqualTo("취향 테스트에서 선택한 우디 계열과 잘 맞아요.");
        assertThat(perfume.originalName()).isEqualTo("Perfume");
        assertThat(perfume.nameKo()).isEqualTo("향수");
        assertThat(perfume.evidenceSource()).isEqualTo("TASTE_TEST");
        assertThat(perfume.evidenceKey()).isEqualTo("WOODY");
    }

    @Test
    void returnsEnglishReasonForEnglishRequest() {
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        PersonalizedRecommendationCandidate candidate = candidate();
        prepareAuthenticatedUser();
        when(cacheInspector.inspect(eq(USER_ID), any()))
                .thenReturn(new CacheSnapshot(false, false, List.of(candidate)));
        when(candidateSelector.select(eq(List.of(candidate)), any())).thenReturn(candidate);

        var perfume = service.recommend().recommendation();

        assertThat(perfume.name()).isEqualTo("향수");
        assertThat(perfume.reason())
                .isEqualTo("It suits the Woody scent family you picked in the Taste Test.");
        assertThat(perfume.originalName()).isEqualTo("Perfume");
        assertThat(perfume.evidenceSource()).isEqualTo("TASTE_TEST");
        assertThat(perfume.evidenceKey()).isEqualTo("WOODY");
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
                "Perfume",
                "향수",
                null,
                1.0,
                "TASTE",
                "우디",
                "WOODY",
                null);
    }
}
