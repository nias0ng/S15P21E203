package com.hyanghae.backend.review.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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
import com.hyanghae.backend.review.repository.ReviewLikeRepository;
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
    private final ReviewLikeRepository reviewLikeRepository = mock(ReviewLikeRepository.class);
    private final PerfumeRepository perfumeRepository = mock(PerfumeRepository.class);
    private final SeasonRepository seasonRepository = mock(SeasonRepository.class);
    private final CurrentUser currentUser = () -> Optional.of(1L);
    private final ReviewService reviewService = new ReviewService(
            perfumeReviewRepository,
            perfumeReviewSeasonRepository,
            reviewLikeRepository,
            perfumeRepository,
            seasonRepository,
            currentUser
    );

    /** 코드를 번호로 바꾸는 자리가 쓰는 값만 답하는 가짜 계절입니다. */
    private static Season season(Long id, String code) {
        Season season = mock(Season.class);
        when(season.getId()).thenReturn(id);
        when(season.getCode()).thenReturn(code);
        return season;
    }

    @Test
    void rejectsDuplicateSeasonCodesBeforeRepositoryLookup() {
        ReviewCreateRequest request = new ReviewCreateRequest(
                "제목",
                "열 글자가 넘는 후기 내용입니다.",
                List.of("SPRING", "SPRING")
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
                List.of("SPRING", "SUMMER")
        );
        Season spring = season(1L, "SPRING");
        when(seasonRepository.findAllByCodeInAndActiveTrue(request.seasonCodes()))
                .thenReturn(List.of(spring));

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
                List.of("SPRING")
        );
        Season spring = season(1L, "SPRING");
        when(seasonRepository.findAllByCodeInAndActiveTrue(request.seasonCodes()))
                .thenReturn(List.of(spring));
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
                new ReviewUpdateRequest("새 제목", null, null)
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
        // 계절을 보내지 않았으므로 바꾸지 않습니다. 응답에 담을 값만 읽어 옵니다.
        verify(perfumeReviewSeasonRepository, never()).deleteAllByReviewId(anyLong());
    }

    @Test
    void replacesSeasons() {
        PerfumeReview review = mock(PerfumeReview.class);
        when(review.getId()).thenReturn(10L);
        when(perfumeReviewRepository.findByIdAndUserIdForUpdate(10L, 1L))
                .thenReturn(Optional.of(review));
        Season autumn = season(3L, "AUTUMN");
        Season winter = season(4L, "WINTER");
        when(seasonRepository.findAllByCodeInAndActiveTrue(List.of("AUTUMN", "WINTER")))
                .thenReturn(List.of(autumn, winter));

        var response = reviewService.replaceSeasons(10L, List.of("AUTUMN", "WINTER"));

        verify(perfumeReviewSeasonRepository).deleteAllByReviewId(10L);
        verify(perfumeReviewSeasonRepository).saveAll(any());
        assertThat(response.seasonCodes()).containsExactly("AUTUMN", "WINTER");
    }

    /**
     * 없는 계절 코드로 교체하면 <b>지우기 전에</b> 멈춥니다.
     *
     * <p>교체는 지우고 다시 넣는 순서라, 검증이 지우기보다 늦으면 거절해 놓고 계절이 비어
     * 버립니다. 통합 테스트가 결과를 보고 여기서는 <b>지우기를 아예 부르지 않는 것</b>을 봅니다 —
     * 트랜잭션이 되돌려서 그렇게 보이는 것과 애초에 안 부르는 것은 다릅니다.
     *
     * <p>내려간 계절도 같은 자리에서 걸립니다. 저장소가 활성만 돌려주므로 없는 코드와 구분되지
     * 않고, 둘 다 화면이 내놓지 않는 값이라 같은 답이 맞습니다.
     */
    @Test
    void rejectsUnknownSeasonCodeBeforeDeletingExisting() {
        when(seasonRepository.findAllByCodeInAndActiveTrue(List.of("NOT_A_SEASON")))
                .thenReturn(List.of());

        assertThatThrownBy(() -> reviewService.replaceSeasons(10L, List.of("NOT_A_SEASON")))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode()).isEqualTo(
                                ReviewErrorCode.REVIEW_SEASON_NOT_FOUND
                        ));
        verifyNoInteractions(perfumeReviewSeasonRepository, perfumeReviewRepository);
    }

    /** 같은 계절을 두 번 고르면 저장소를 찾아보기도 전에 400 입니다. */
    @Test
    void rejectsDuplicateSeasonCodesOnReplace() {
        assertThatThrownBy(() -> reviewService.replaceSeasons(10L, List.of("SUMMER", "SUMMER")))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode()).isEqualTo(
                                ReviewErrorCode.REVIEW_INVALID_SEASONS
                        ));
        verifyNoInteractions(
                seasonRepository, perfumeReviewSeasonRepository, perfumeReviewRepository);
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
