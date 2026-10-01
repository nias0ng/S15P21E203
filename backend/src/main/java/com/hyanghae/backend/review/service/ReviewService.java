package com.hyanghae.backend.review.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.perfume.entity.Season;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.perfume.repository.SeasonRepository;
import com.hyanghae.backend.review.dto.request.ReviewCreateRequest;
import com.hyanghae.backend.review.dto.request.ReviewUpdateRequest;
import com.hyanghae.backend.review.dto.response.ReviewBoardItemResponse;
import com.hyanghae.backend.review.dto.response.ReviewBoardResponse;
import com.hyanghae.backend.review.dto.response.ReviewCreateResponse;
import com.hyanghae.backend.review.dto.response.ReviewDetailResponse;
import com.hyanghae.backend.review.dto.response.ReviewLikeResponse;
import com.hyanghae.backend.review.dto.response.ReviewPerfumeResponse;
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
import com.hyanghae.backend.review.repository.ReviewBoardRow;
import com.hyanghae.backend.review.repository.ReviewLikeRepository;
import com.hyanghae.backend.review.repository.ReviewSeasonRow;
import com.hyanghae.backend.review.repository.ReviewSort;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final ReviewLikeRepository reviewLikeRepository;
    private final PerfumeRepository perfumeRepository;
    private final SeasonRepository seasonRepository;
    private final CurrentUser currentUser;

    public ReviewService(
            PerfumeReviewRepository perfumeReviewRepository,
            PerfumeReviewSeasonRepository perfumeReviewSeasonRepository,
            ReviewLikeRepository reviewLikeRepository,
            PerfumeRepository perfumeRepository,
            SeasonRepository seasonRepository,
            CurrentUser currentUser
    ) {
        this.perfumeReviewRepository = perfumeReviewRepository;
        this.perfumeReviewSeasonRepository = perfumeReviewSeasonRepository;
        this.reviewLikeRepository = reviewLikeRepository;
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
        List<Long> seasonIds = toSeasonIds(request.seasonCodes());
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

        saveSeasons(review.getId(), seasonIds);
        return new ReviewCreateResponse(
                review.getId(),
                review.getTitle(),
                review.getContent(),
                request.seasonCodes(),
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
        List<String> seasonCodes = applySeasons(reviewId, request.seasonCodes());

        return new ReviewUpdateResponse(reviewId, title, content, seasonCodes, updatedAt);
    }

    /**
     * 계절을 통째로 바꾸고, 고쳐진 결과를 돌려줍니다. 보내지 않았으면 지금 값을 읽어 옵니다.
     *
     * <p><b>코드 검증을 바꾸기 전에 합니다.</b> 여기서 예외가 나면 같은 트랜잭션 안의 제목·내용
     * 변경까지 함께 되돌아갑니다 — 이 메서드가 생긴 이유가 바로 그 원자성입니다. 계절만 따로
     * 받던 시절에는 제목은 저장되고 계절만 실패하는 어긋남이 생겼습니다.
     *
     * <p>보내지 않았을 때 굳이 읽어 오는 것은 응답이 <b>고쳐진 결과 전체</b>를 담기 위해서입니다.
     * 화면이 이 응답만으로 캐시를 갱신할 수 있어야 상세를 다시 부르지 않습니다.
     */
    private List<String> applySeasons(Long reviewId, List<String> seasonCodes) {
        if (seasonCodes == null) {
            return currentSeasonCodes(reviewId);
        }
        List<Long> seasonIds = toSeasonIds(seasonCodes);
        perfumeReviewSeasonRepository.deleteAllByReviewId(reviewId);
        saveSeasons(reviewId, seasonIds);
        return seasonCodes;
    }

    private List<String> currentSeasonCodes(Long reviewId) {
        return perfumeReviewSeasonRepository.findAllByReviewIds(List.of(reviewId))
                .stream()
                .map(ReviewSeasonRow::code)
                .toList();
    }

    @Transactional
    public void delete(Long reviewId) {
        PerfumeReview review = findMineForUpdate(reviewId);
        perfumeReviewRepository.delete(review);
    }

    @Transactional
    public ReviewSeasonsResponse replaceSeasons(
            Long reviewId,
            List<String> seasonCodes
    ) {
        List<Long> seasonIds = toSeasonIds(seasonCodes);
        PerfumeReview review = findMineForUpdate(reviewId);
        perfumeReviewSeasonRepository.deleteAllByReviewId(review.getId());
        saveSeasons(review.getId(), seasonIds);
        return new ReviewSeasonsResponse(reviewId, seasonCodes);
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
                        row.getProfileImageUrl(),
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

    /**
     * 계절 코드를 번호로 바꿉니다. 저장은 번호로 합니다.
     *
     * <p>화면과 주고받는 말은 코드이고 표를 잇는 것은 번호입니다. 그 사이를 여기 한 곳에서만
     * 넘습니다 — 작성과 교체가 같은 규칙을 쓰게 하려는 것입니다.
     *
     * <p>같은 계절을 두 번 고르면 400 입니다. 표의 기본키도 막지만 여기서 걸러야 무엇이
     * 잘못됐는지 알려줄 수 있습니다. 없는 코드는 404 입니다.
     *
     * <p><b>고른 순서를 지킵니다.</b> 화면이 보낸 차례가 응답에도 그대로 나가야 사용자가 누른
     * 순서와 어긋나 보이지 않습니다.
     */
    private List<Long> toSeasonIds(List<String> seasonCodes) {
        if (new HashSet<>(seasonCodes).size() != seasonCodes.size()) {
            throw new BusinessException(ReviewErrorCode.REVIEW_INVALID_SEASONS);
        }

        Map<String, Long> idByCode = seasonRepository.findAllByCodeInAndActiveTrue(seasonCodes)
                .stream()
                .collect(Collectors.toMap(Season::getCode, Season::getId));
        if (idByCode.size() != seasonCodes.size()) {
            throw new BusinessException(ReviewErrorCode.REVIEW_SEASON_NOT_FOUND);
        }
        return seasonCodes.stream().map(idByCode::get).toList();
    }

    private void saveSeasons(Long reviewId, List<Long> seasonIds) {
        List<PerfumeReviewSeason> seasons = seasonIds.stream()
                .map(seasonId -> PerfumeReviewSeason.of(reviewId, seasonId))
                .toList();
        perfumeReviewSeasonRepository.saveAll(seasons);
    }

    /**
     * 후기 게시판 목록입니다. 향수를 가리지 않고 전체를 봅니다.
     *
     * <p>향수 상세의 후기 목록({@link #findByPerfume})과 다릅니다. 거기서는 향수 하나의 후기만
     * 보고 어느 향수인지 이미 알지만, 게시판은 여러 향수의 후기가 섞여 나오므로 줄마다 향수를
     * 함께 싣습니다.
     *
     * <p>정렬은 셋입니다 — 최신순·조회 순·좋아요 순. 댓글 많은 순이 없는 이유는 후기에 댓글을
     * 달지 않기 때문입니다(와이어프레임 A22a).
     *
     * <p>계절과 내가 누른 좋아요는 각각 한 번에 모아 읽습니다. 후기마다 따로 조회하면 한 페이지에
     * 쿼리가 스무 번씩 나갑니다.
     */
    @Transactional(readOnly = true)
    public ReviewBoardResponse findBoardPage(ReviewSort sort, int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        PageRequest pageRequest = PageRequest.of(pageNumber, pageSize);

        Page<ReviewBoardRow> found = switch (sort) {
            case RECENT -> perfumeReviewRepository.findBoardPageByRecent(pageRequest);
            case VIEWS -> perfumeReviewRepository.findBoardPageByViews(pageRequest);
            case LIKES -> perfumeReviewRepository.findBoardPageByLikes(pageRequest);
        };
        if (found.isEmpty()) {
            return new ReviewBoardResponse(
                    List.of(), found.getNumber(), found.getSize(), found.getTotalElements());
        }

        List<Long> reviewIds = found.getContent().stream()
                .map(ReviewBoardRow::getReviewId)
                .toList();
        Set<Long> liked = likedAmong(reviewIds);

        List<ReviewBoardItemResponse> reviews = found.getContent().stream()
                .map(row -> new ReviewBoardItemResponse(
                        row.getReviewId(),
                        row.getTitle(),
                        row.getContent(),
                        row.getNickname(),
                        row.getProfileImageUrl(),
                        perfumeOf(row),
                        row.getLikeCount(),
                        row.getViewCount(),
                        liked.contains(row.getReviewId()),
                        row.getCreatedAt()
                ))
                .toList();

        return new ReviewBoardResponse(
                reviews, found.getNumber(), found.getSize(), found.getTotalElements());
    }

    /**
     * 후기 상세입니다. 없는 후기는 404 입니다.
     *
     * <p><b>읽기 전용이 아닙니다.</b> 여는 것이 곧 조회이므로 여기서 조회수를 올립니다. 화면이
     * 따로 "봤다" 고 알리게 하면 요청이 한 번 더 오가고, 그 요청을 빠뜨린 화면은 조회가 세지지
     * 않습니다.
     *
     * <p>올린 뒤에 읽습니다. 순서를 바꾸면 방금 올린 것이 빠진 숫자가 나가서, 열었는데 그대로인
     * 것처럼 보입니다.
     */
    @Transactional
    public ReviewDetailResponse findOne(Long reviewId) {
        if (perfumeReviewRepository.increaseViewCount(reviewId) == 0) {
            throw new BusinessException(ReviewErrorCode.REVIEW_NOT_FOUND);
        }
        ReviewBoardRow row = perfumeReviewRepository.findBoardRow(reviewId)
                .orElseThrow(() -> new BusinessException(ReviewErrorCode.REVIEW_NOT_FOUND));

        return new ReviewDetailResponse(
                row.getReviewId(),
                row.getTitle(),
                row.getContent(),
                row.getNickname(),
                row.getProfileImageUrl(),
                perfumeOf(row),
                loadSeasons(List.of(reviewId)).getOrDefault(reviewId, List.of()),
                row.getLikeCount(),
                row.getViewCount(),
                isLikedByMe(reviewId),
                isMine(reviewId),
                row.getCreatedAt(),
                row.getUpdatedAt()
        );
    }

    /**
     * 좋아요를 누릅니다. 여러 번 눌러도 결과가 같습니다.
     *
     * <p>이미 누른 후기에 또 누르면 아무 일도 일어나지 않고 지금 상태를 그대로 돌려줍니다. 오류가
     * 아닙니다. 사용자가 원한 상태("좋아요가 눌려 있다")가 이미 이루어져 있기 때문입니다.
     */
    @Transactional
    public ReviewLikeResponse like(Long reviewId) {
        Long userId = currentUserId();
        requireReview(reviewId);

        // 넣은 행 수를 일부러 버립니다. 처음 누른 것(1)과 이미 눌러 둔 것(0)의 응답이 같아야
        // 하기 때문입니다. 글 좋아요와 같은 판단입니다.
        reviewLikeRepository.like(reviewId, userId);

        return new ReviewLikeResponse(
                reviewId, true, reviewLikeRepository.countOfReview(reviewId));
    }

    /** 좋아요를 취소합니다. 누르지 않은 후기에 취소해도 오류가 아닙니다. */
    @Transactional
    public ReviewLikeResponse unlike(Long reviewId) {
        Long userId = currentUserId();
        requireReview(reviewId);
        reviewLikeRepository.unlike(reviewId, userId);

        return new ReviewLikeResponse(
                reviewId, false, reviewLikeRepository.countOfReview(reviewId));
    }

    private void requireReview(Long reviewId) {
        if (!perfumeReviewRepository.existsById(reviewId)) {
            throw new BusinessException(ReviewErrorCode.REVIEW_NOT_FOUND);
        }
    }

    /** 향수가 비어 있는 후기가 있을 수 있어 번호를 먼저 봅니다. */
    private ReviewPerfumeResponse perfumeOf(ReviewBoardRow row) {
        return row.getPerfumeId() == null
                ? null
                : new ReviewPerfumeResponse(
                        row.getPerfumeId(), row.getPerfumeName(), row.getPerfumeNameKo(),
                        row.getBrand(), row.getBrandKo());
    }

    /**
     * 이 목록에서 내가 좋아요를 누른 후기입니다.
     *
     * <p>비로그인이면 빈 집합입니다. 게시판은 누구나 볼 수 있어야 하므로 로그인을 요구하지
     * 않습니다.
     */
    private Set<Long> likedAmong(List<Long> reviewIds) {
        return currentUser.id()
                .map(userId -> Set.copyOf(
                        reviewLikeRepository.findLikedReviewIds(userId, reviewIds)))
                .orElseGet(Set::of);
    }

    /** 내가 좋아요를 눌렀는지입니다. 비로그인이면 거짓입니다. */
    private boolean isLikedByMe(Long reviewId) {
        return currentUser.id()
                .map(userId -> reviewLikeRepository.isLikedBy(reviewId, userId))
                .orElse(false);
    }

    /**
     * 내가 쓴 후기인지입니다. 화면이 수정·삭제 버튼을 띄울지 정하는 데 씁니다.
     *
     * <p>로그인을 <b>요구하지 않습니다.</b> 비로그인이면 그냥 거짓입니다. 상세는 누구나 볼 수
     * 있어야 하므로 401 을 던지면 안 됩니다. 작성자가 탈퇴한 후기도 주인이 없어 항상 거짓입니다.
     */
    private boolean isMine(Long reviewId) {
        return currentUser.id()
                .map(userId -> perfumeReviewRepository.existsByIdAndUserId(reviewId, userId))
                .orElse(false);
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
