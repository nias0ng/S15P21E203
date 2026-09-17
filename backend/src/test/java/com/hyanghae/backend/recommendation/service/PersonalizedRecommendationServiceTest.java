package com.hyanghae.backend.recommendation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
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
    private CurrentUser currentUser;

    private PersonalizedRecommendationService service;

    @BeforeEach
    void setUp() {
        service = new PersonalizedRecommendationService(
                recommendationRepository,
                candidateSelector,
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
}
