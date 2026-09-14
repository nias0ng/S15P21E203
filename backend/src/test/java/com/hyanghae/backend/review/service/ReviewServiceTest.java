package com.hyanghae.backend.review.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.perfume.entity.Season;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.perfume.repository.SeasonRepository;
import com.hyanghae.backend.review.dto.request.ReviewCreateRequest;
import com.hyanghae.backend.review.dto.request.ReviewUpdateRequest;
import com.hyanghae.backend.review.entity.PerfumeReview;
import com.hyanghae.backend.review.exception.ReviewErrorCode;
import com.hyanghae.backend.review.repository.PerfumeReviewListRow;
import com.hyanghae.backend.review.repository.PerfumeReviewRepository;
import com.hyanghae.backend.review.repository.PerfumeReviewSeasonRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class ReviewServiceTest {

    private final PerfumeReviewRepository perfumeReviewRepository =
            mock(PerfumeReviewRepository.class);
    private final PerfumeReviewSeasonRepository perfumeReviewSeasonRepository =
            mock(PerfumeReviewSeasonRepository.class);
    private final PerfumeRepository perfumeRepository = mock(PerfumeRepository.class);
    private final SeasonRepository seasonRepository = mock(SeasonRepository.class);
    private final CurrentUser currentUser = () -> Optional.of(1L);
    private final ReviewService reviewService = new ReviewService(
            perfumeReviewRepository,
            perfumeReviewSeasonRepository,
            perfumeRepository,
            seasonRepository,
            currentUser
    );

    @Test
    void rejectsDuplicateSeasonIdsBeforeRepositoryLookup() {
        ReviewCreateRequest request = new ReviewCreateRequest(
                "제목",
                "열 글자가 넘는 후기 내용입니다.",
                List.of(1L, 1L)
        );

        assertThatThrownBy(() -> reviewService.create(1L, request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode()).isEqualTo(
                                ReviewErrorCode.REVIEW_INVALID_SEASONS
                        ));
        verifyNoInteractions(seasonRepository, perfumeRepository, perfumeReviewRepository);
    }

    @Test
    void rejectsMissingSeasonBeforeCreatingReview() {
        ReviewCreateRequest request = new ReviewCreateRequest(
                "제목",
                "열 글자가 넘는 후기 내용입니다.",
                List.of(1L, 2L)
        );
        when(seasonRepository.findAllByIdInAndActiveTrue(request.seasonIds()))
                .thenReturn(List.of(mock(Season.class)));

        assertThatThrownBy(() -> reviewService.create(1L, request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode()).isEqualTo(
                                ReviewErrorCode.REVIEW_SEASON_NOT_FOUND
                        ));
        verifyNoInteractions(perfumeRepository, perfumeReviewRepository);
    }

    @Test
    void rejectsExistingReview() {
        ReviewCreateRequest request = new ReviewCreateRequest(
                "제목",
                "열 글자가 넘는 후기 내용입니다.",
                List.of(1L)
        );
        when(seasonRepository.findAllByIdInAndActiveTrue(request.seasonIds()))
                .thenReturn(List.of(mock(Season.class)));
        when(perfumeRepository.findByIdAndActiveTrue(1L))
                .thenReturn(Optional.of(mock(Perfume.class)));
        when(perfumeReviewRepository.existsByUserIdAndPerfumeId(1L, 1L))
                .thenReturn(true);

        assertThatThrownBy(() -> reviewService.create(1L, request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode()).isEqualTo(
                                ReviewErrorCode.REVIEW_ALREADY_EXISTS
                        ));
        verify(perfumeReviewRepository, never()).saveAndFlush(any(PerfumeReview.class));
    }

    @Test
    void updatesOnlyProvidedField() {
        PerfumeReview review = mock(PerfumeReview.class);
        when(perfumeReviewRepository.findByIdAndUserIdForUpdate(10L, 1L))
                .thenReturn(Optional.of(review));
        when(review.getTitle()).thenReturn("기존 제목");
        when(review.getContent()).thenReturn("기존 후기 내용입니다.");

        var response = reviewService.update(
                10L,
                new ReviewUpdateRequest("새 제목", null)
        );

        ArgumentCaptor<Instant> updatedAt = ArgumentCaptor.forClass(Instant.class);
        verify(review).update(
                eq("새 제목"),
                eq("기존 후기 내용입니다."),
                updatedAt.capture()
        );
        assertThat(response.title()).isEqualTo("새 제목");
        assertThat(response.content()).isEqualTo("기존 후기 내용입니다.");
        assertThat(response.updatedAt()).isEqualTo(updatedAt.getValue());
    }

    @Test
    void replacesSeasons() {
        PerfumeReview review = mock(PerfumeReview.class);
        when(review.getId()).thenReturn(10L);
        when(perfumeReviewRepository.findByIdAndUserIdForUpdate(10L, 1L))
                .thenReturn(Optional.of(review));
        when(seasonRepository.findAllByIdInAndActiveTrue(List.of(2L, 3L)))
                .thenReturn(List.of(mock(Season.class), mock(Season.class)));

        var response = reviewService.replaceSeasons(10L, List.of(2L, 3L));

        verify(perfumeReviewSeasonRepository).deleteAllByReviewId(10L);
        verify(perfumeReviewSeasonRepository).saveAll(any());
        assertThat(response.seasonIds()).containsExactly(2L, 3L);
    }

    @Test
    void emptyReviewPagePreservesMetadataAndClampsSize() {
        PageRequest pageRequest = PageRequest.of(5, 100);
        when(perfumeRepository.existsByIdAndActiveTrue(1L)).thenReturn(true);
        when(perfumeReviewRepository.findPageByPerfumeId(1L, 1L, pageRequest))
                .thenReturn(new PageImpl<PerfumeReviewListRow>(List.of(), pageRequest, 13L));

        var response = reviewService.findByPerfume(1L, 5, 1000);

        assertThat(response.reviews()).isEmpty();
        assertThat(response.page()).isEqualTo(5);
        assertThat(response.size()).isEqualTo(100);
        assertThat(response.totalElements()).isEqualTo(13);
        verifyNoInteractions(perfumeReviewSeasonRepository);
    }
}
