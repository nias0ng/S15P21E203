package com.hyanghae.backend.recommendation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PersonalizedRecommendationExposureServiceTest {

    private static final long USER_ID = 1L;
    private static final UUID TOKEN = UUID.fromString("e1ef3a45-b164-49e5-bf11-d182021356c9");

    @Mock
    private PersonalizedRecommendationRepository repository;

    @Mock
    private CurrentUser currentUser;

    private PersonalizedRecommendationExposureService service;

    @BeforeEach
    void setUp() {
        service = new PersonalizedRecommendationExposureService(repository, currentUser);
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
    }

    @Test
    void recordsOnlyTheOfferedPerfume() {
        when(repository.hasCompletedExposure(TOKEN, USER_ID)).thenReturn(false);
        when(repository.findValidOfferForUpdate(eq(TOKEN), eq(USER_ID), any()))
                .thenReturn(Optional.of(10L));

        service.complete(TOKEN);

        verify(repository).saveExposure(any(), any(), any(), any());
        verify(repository).deleteOffer(TOKEN);
    }

    @Test
    void treatsRepeatedCompletionAsSuccess() {
        when(repository.hasCompletedExposure(TOKEN, USER_ID)).thenReturn(true);

        service.complete(TOKEN);

        verify(repository, never()).findValidOfferForUpdate(any(), any(), any());
        verify(repository, never()).saveExposure(any(), any(), any(), any());
    }

    @Test
    void hidesUnknownOrAnotherUsersToken() {
        when(repository.hasCompletedExposure(TOKEN, USER_ID)).thenReturn(false);
        when(repository.findValidOfferForUpdate(eq(TOKEN), eq(USER_ID), any()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.complete(TOKEN))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(RecommendationErrorCode.RECOMMENDATION_EXPOSURE_NOT_FOUND));
    }
}
