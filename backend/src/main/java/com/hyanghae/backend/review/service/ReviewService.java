package com.hyanghae.backend.review.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.perfume.repository.SeasonRepository;
import com.hyanghae.backend.review.dto.request.ReviewCreateRequest;
import com.hyanghae.backend.review.dto.request.ReviewUpdateRequest;
import com.hyanghae.backend.review.dto.response.ReviewCreateResponse;
import com.hyanghae.backend.review.dto.response.ReviewResponse;
import com.hyanghae.backend.review.dto.response.ReviewSeasonsResponse;
import com.hyanghae.backend.review.dto.response.ReviewUpdateResponse;
import com.hyanghae.backend.review.dto.response.ReviewsResponse;
import com.hyanghae.backend.review.dto.response.ReviewSeasonResponse;
import com.hyanghae.backend.review.entity.PerfumeReview;
import com.hyanghae.backend.review.entity.PerfumeReviewSeason;
import com.hyanghae.backend.review.exception.ReviewErrorCode;
import com.hyanghae.backend.review.repository.PerfumeReviewListRow;
import com.hyanghae.backend.review.repository.PerfumeReviewRepository;
import com.hyanghae.backend.review.repository.PerfumeReviewSeasonRepository;
import com.hyanghae.backend.review.repository.ReviewSeasonRow;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReviewService {

    private static final int MAX_PAGE_SIZE = 100;

    private final PerfumeReviewRepository perfumeReviewRepository;
    private final PerfumeReviewSeasonRepository perfumeReviewSeasonRepository;
    private final PerfumeRepository perfumeRepository;
    private final SeasonRepository seasonRepository;
    private final CurrentUser currentUser;

    public ReviewService(
            PerfumeReviewRepository perfumeReviewRepository,
            PerfumeReviewSeasonRepository perfumeReviewSeasonRepository,
            PerfumeRepository perfumeRepository,
            SeasonRepository seasonRepository,
            CurrentUser currentUser
    ) {
        this.perfumeReviewRepository = perfumeReviewRepository;
        this.perfumeReviewSeasonRepository = perfumeReviewSeasonRepository;
        this.perfumeRepository = perfumeRepository;
        this.seasonRepository = seasonRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public ReviewCreateResponse create(
            Long perfumeId,
            ReviewCreateRequest request
    ) {
        Long userId = currentUserId();
        validateSeasonIds(request.seasonIds());
        Perfume perfume = perfumeRepository.findByIdAndActiveTrue(perfumeId)
                .orElseThrow(() -> new BusinessException(PerfumeErrorCode.PERFUME_NOT_FOUND));

        if (perfumeReviewRepository.existsByUserIdAndPerfumeId(userId, perfumeId)) {
            throw new BusinessException(ReviewErrorCode.REVIEW_ALREADY_EXISTS);
        }

        Instant createdAt = Instant.now();
        PerfumeReview review = PerfumeReview.create(
                userId,
                perfume,
                request.title(),
                request.content(),
                createdAt
        );
        try {
            perfumeReviewRepository.saveAndFlush(review);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ReviewErrorCode.REVIEW_ALREADY_EXISTS);
        }

        saveSeasons(review.getId(), request.seasonIds());
        return new ReviewCreateResponse(
                review.getId(),
                review.getTitle(),
                review.getContent(),
                request.seasonIds(),
                review.getCreatedAt()
        );
    }

    @Transactional
    public ReviewUpdateResponse update(
            Long reviewId,
            ReviewUpdateRequest request
    ) {
        PerfumeReview review = findMineForUpdate(reviewId);
        String title = request.title() == null ? review.getTitle() : request.title();
        String content = request.content() == null ? review.getContent() : request.content();
        Instant updatedAt = Instant.now();

        review.update(title, content, updatedAt);
        return new ReviewUpdateResponse(reviewId, title, content, updatedAt);
    }

    @Transactional
    public void delete(Long reviewId) {
        PerfumeReview review = findMineForUpdate(reviewId);
        perfumeReviewRepository.delete(review);
    }

    @Transactional
    public ReviewSeasonsResponse replaceSeasons(
            Long reviewId,
            List<Long> seasonIds
    ) {
        validateSeasonIds(seasonIds);
        PerfumeReview review = findMineForUpdate(reviewId);
        perfumeReviewSeasonRepository.deleteAllByReviewId(review.getId());
        saveSeasons(review.getId(), seasonIds);
        return new ReviewSeasonsResponse(reviewId, seasonIds);
    }

    @Transactional(readOnly = true)
    public ReviewsResponse findByPerfume(Long perfumeId, int page, int size) {
        if (!perfumeRepository.existsByIdAndActiveTrue(perfumeId)) {
            throw new BusinessException(PerfumeErrorCode.PERFUME_NOT_FOUND);
        }

        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        Page<PerfumeReviewListRow> found = perfumeReviewRepository.findPageByPerfumeId(
                perfumeId,
                currentUser.id().orElse(null),
                PageRequest.of(pageNumber, pageSize)
        );
        if (found.isEmpty()) {
            return new ReviewsResponse(
                    List.of(),
                    found.getNumber(),
                    found.getSize(),
                    found.getTotalElements()
            );
        }

        List<Long> reviewIds = found.getContent().stream()
                .map(PerfumeReviewListRow::getReviewId)
                .toList();
        Map<Long, List<ReviewSeasonResponse>> seasonsByReview = loadSeasons(reviewIds);
        List<ReviewResponse> reviews = found.getContent().stream()
                .map(row -> new ReviewResponse(
                        row.getReviewId(),
                        row.getNickname(),
                        row.getTitle(),
                        row.getContent(),
                        seasonsByReview.getOrDefault(row.getReviewId(), List.of()),
                        row.getMine(),
                        row.getCreatedAt(),
                        row.getUpdatedAt()
                ))
                .toList();

        return new ReviewsResponse(
                reviews,
                found.getNumber(),
                found.getSize(),
                found.getTotalElements()
        );
    }

    private PerfumeReview findMineForUpdate(Long reviewId) {
        return perfumeReviewRepository
                .findByIdAndUserIdForUpdate(reviewId, currentUserId())
                .orElseThrow(() -> new BusinessException(
                        ReviewErrorCode.REVIEW_NOT_FOUND
                ));
    }

    private void validateSeasonIds(List<Long> seasonIds) {
        if (new HashSet<>(seasonIds).size() != seasonIds.size()) {
            throw new BusinessException(ReviewErrorCode.REVIEW_INVALID_SEASONS);
        }
        if (seasonRepository.findAllByIdInAndActiveTrue(seasonIds).size() != seasonIds.size()) {
            throw new BusinessException(ReviewErrorCode.REVIEW_SEASON_NOT_FOUND);
        }
    }

    private void saveSeasons(Long reviewId, List<Long> seasonIds) {
        List<PerfumeReviewSeason> seasons = seasonIds.stream()
                .map(seasonId -> PerfumeReviewSeason.of(reviewId, seasonId))
                .toList();
        perfumeReviewSeasonRepository.saveAll(seasons);
    }

    private Map<Long, List<ReviewSeasonResponse>> loadSeasons(List<Long> reviewIds) {
        return perfumeReviewSeasonRepository.findAllByReviewIds(reviewIds).stream()
                .collect(Collectors.groupingBy(
                        ReviewSeasonRow::reviewId,
                        Collectors.mapping(
                                row -> new ReviewSeasonResponse(
                                        row.seasonId(),
                                        row.code(),
                                        row.name()
                                ),
                                Collectors.toList()
                        )
                ));
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(
                        ReviewErrorCode.REVIEW_LOGIN_REQUIRED
                ));
    }
}
