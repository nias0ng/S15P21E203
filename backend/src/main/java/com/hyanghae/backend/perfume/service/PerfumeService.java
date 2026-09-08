package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.dto.request.PerfumeSearchCondition;
import com.hyanghae.backend.perfume.dto.request.ShelfFilter;
import com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeNotesResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewStatisticsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSeasonStatisticResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSeasonStatisticsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSearchResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.perfume.repository.PerfumeScentFamilyRepository;
import com.hyanghae.backend.perfume.repository.PerfumeShelfRepository;
import com.hyanghae.backend.perfume.dto.response.PerfumePriceResponse;
import com.hyanghae.backend.perfume.repository.PerfumeAccordRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.perfume.repository.PerfumeNoteRepository;
import com.hyanghae.backend.perfume.repository.PerfumeReviewRepository;
import com.hyanghae.backend.perfume.repository.PerfumePriceRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PerfumeService {

    /** 비율의 소수점 자리수입니다. */
    private static final int RATIO_SCALE = 3;

    private final PerfumeRepository perfumeRepository;
    private final PerfumeImageRepository perfumeImageRepository;
    private final PerfumePriceRepository perfumePriceRepository;
    private final PerfumeScentFamilyRepository perfumeScentFamilyRepository;
    private final PerfumeShelfRepository perfumeShelfRepository;
    private final CurrentUser currentUser;
    private final PerfumeNoteRepository perfumeNoteRepository;
    private final PerfumeAccordRepository perfumeAccordRepository;
    private final PerfumeReviewRepository perfumeReviewRepository;

    public PerfumeService(
            PerfumeRepository perfumeRepository,
            PerfumeImageRepository perfumeImageRepository,
            PerfumePriceRepository perfumePriceRepository,
            PerfumeScentFamilyRepository perfumeScentFamilyRepository,
            PerfumeShelfRepository perfumeShelfRepository,
            CurrentUser currentUser,
            PerfumeNoteRepository perfumeNoteRepository,
            PerfumeAccordRepository perfumeAccordRepository,
            PerfumeReviewRepository perfumeReviewRepository
    ) {
        this.perfumeRepository = perfumeRepository;
        this.perfumeImageRepository = perfumeImageRepository;
        this.perfumePriceRepository = perfumePriceRepository;
        this.perfumeScentFamilyRepository = perfumeScentFamilyRepository;
        this.perfumeShelfRepository = perfumeShelfRepository;
        this.currentUser = currentUser;
        this.perfumeNoteRepository = perfumeNoteRepository;
        this.perfumeAccordRepository = perfumeAccordRepository;
        this.perfumeReviewRepository = perfumeReviewRepository;
    }

    /**
     * 향수명·브랜드명으로 향수를 검색합니다.
     *
     * <p>조건을 하나도 주지 않으면 활성 향수 전체를 페이지 단위로 돌려줍니다. 이 엔드포인트는
     * 검색창뿐 아니라 향수 목록 화면도 함께 쓰는데, 목록 화면은 필터를 걸기 전에도 향수가 보여야
     * 합니다. 조건 없는 요청에 빈 목록을 주면 목록 화면이 "검색 결과가 없습니다" 로 시작합니다.
     *
     * <p>전체를 준다고 해서 카탈로그를 통째로 내려주는 것은 아닙니다. 페이지 크기가 걸려 있어
     * 한 번에 나가는 건수는 조건이 있을 때와 같습니다.
     *
     * <p>진열대 필터만 다르게 다룹니다. 향수의 속성이 아니라 요청자와 향수의 관계라서, 요청자를
     * 알 수 없으면 401 입니다. 조용히 전체를 돌려주면 필터가 걸린 것처럼 보이지만 남의 자료가
     * 섞입니다.
     */
    @Transactional(readOnly = true)
    public PerfumeSearchResponse search(PerfumeSearchCondition condition, Pageable pageable) {
        String keyword = normalize(condition.keyword());
        String brand = trimToNull(condition.brand());
        String gender = condition.gender() == null ? null : condition.gender().name();

        Page<PerfumeSummaryResponse> found = findPage(condition.shelf(), keyword, brand, gender, pageable);
        if (found.isEmpty()) {
            return PerfumeSearchResponse.from(found);
        }

        List<Long> perfumeIds = found.getContent().stream()
                .map(PerfumeSummaryResponse::perfumeId)
                .toList();
        Map<Long, String> images = loadThumbnails(perfumeIds);
        Map<Long, String> scentFamilies = perfumeScentFamilyRepository.findByPerfumeIds(perfumeIds);

        return PerfumeSearchResponse.from(found.map(perfume -> perfume.with(
                images.get(perfume.perfumeId()),
                scentFamilies.get(perfume.perfumeId())
        )));
    }

    /**
     * 향수 기본 정보를 조회합니다.
     *
     * <p>기능 명세의 "향수 정보가 존재하지 않는 경우 조회 실패 사실을 안내한다" 에 따라 없는 향수는
     * 예외를 던집니다. 향조·후기·후기 통계·계절별 평가는 명세가 별도 기능으로 분리해 두었으므로
     * 여기서 내려주지 않습니다.
     */
    @Transactional(readOnly = true)
    public PerfumeDetailResponse getDetail(Long perfumeId) {
        PerfumeDetailResponse detail = perfumeRepository.findDetailById(perfumeId)
                .orElseThrow(() -> new BusinessException(PerfumeErrorCode.PERFUME_NOT_FOUND));

        return detail.withImagesAndPrices(
                loadImages(perfumeId),
                perfumePriceRepository.findByPerfumeId(perfumeId)
        );
    }

    /**
     * 향수 한 건의 이미지를 대표 이미지가 먼저 오도록 전부 가져옵니다. 검색이 쓰는 조회와 같은
     * 정렬 규칙을 쓰므로, 두 API 가 이미지 순서를 다르게 보는 일이 없습니다.
     */
    /**
     * 향수의 노트와 어코드를 조회합니다.
     *
     * <p>향조 정보가 없는 향수는 두 목록이 빈 배열입니다. 없는 향수와 구분해야 하므로 존재하지
     * 않는 향수에만 404 를 반환합니다.
     */
    @Transactional(readOnly = true)
    public PerfumeNotesResponse getNotes(Long perfumeId) {
        requireExistingPerfume(perfumeId);

        return new PerfumeNotesResponse(
                perfumeNoteRepository.findByPerfumeId(perfumeId),
                perfumeAccordRepository.findByPerfumeId(perfumeId)
        );
    }

    /** 향수의 후기 수를 반환합니다. */
    @Transactional(readOnly = true)
    public PerfumeReviewStatisticsResponse getReviewStatistics(Long perfumeId) {
        requireExistingPerfume(perfumeId);

        return new PerfumeReviewStatisticsResponse(
                perfumeReviewRepository.countByPerfumeId(perfumeId)
        );
    }

    /**
     * 후기가 고른 계절의 분포를 반환합니다.
     *
     * <p>분모는 계절을 하나라도 고른 후기 수입니다. 후기 하나가 계절을 여러 개 고를 수 있어
     * 계절별 비율의 합이 1 을 넘을 수 있습니다. 계절을 고르지 않은 후기까지 분모에 넣으면
     * 계절을 답한 사람들의 분포가 희석됩니다.
     */
    @Transactional(readOnly = true)
    public PerfumeSeasonStatisticsResponse getSeasonStatistics(Long perfumeId) {
        requireExistingPerfume(perfumeId);

        long reviewsWithSeason = perfumeReviewRepository.countReviewsWithSeasonByPerfumeId(perfumeId);

        return new PerfumeSeasonStatisticsResponse(
                perfumeReviewRepository.findSeasonCountsByPerfumeId(perfumeId).stream()
                        .map(season -> new PerfumeSeasonStatisticResponse(
                                season.seasonId(),
                                season.code(),
                                season.name(),
                                season.count(),
                                ratioOf(season.count(), reviewsWithSeason)
                        ))
                        .toList()
        );
    }

    /** 분모가 0 이면 나눗셈 대신 0 을 씁니다. 후기가 없거나 아무도 계절을 고르지 않은 경우입니다. */
    private BigDecimal ratioOf(long count, long total) {
        if (total == 0) {
            return BigDecimal.ZERO.setScale(RATIO_SCALE);
        }
        return BigDecimal.valueOf(count)
                .divide(BigDecimal.valueOf(total), RATIO_SCALE, RoundingMode.HALF_UP);
    }

    private void requireExistingPerfume(Long perfumeId) {
        if (!perfumeRepository.existsByIdAndActiveTrue(perfumeId)) {
            throw new BusinessException(PerfumeErrorCode.PERFUME_NOT_FOUND);
        }
    }

    private List<String> loadImages(Long perfumeId) {
        return perfumeImageRepository.findOrderedByPerfumeIds(List.of(perfumeId)).stream()
                .map(PerfumeImageUrl::imageUrl)
                .toList();
    }

    /**
     * 향수들의 대표 이미지를 한 번의 쿼리로 가져옵니다.
     *
     * <p>조회 쿼리에 이미지 조인을 합치지 않는 이유는, 한 향수에 이미지가 여러 장이면 행이 중복되고
     * {@code display_order} 가 같거나 {@code NULL} 인 경우 어떤 행이 남을지 예측하기 어려워지기
     * 때문입니다. 정렬된 결과에서 향수별 첫 행만 취하면 규칙이 명확하고, 검색과 기본 정보 조회가
     * 같은 규칙을 씁니다.
     */
    private Map<Long, String> loadThumbnails(List<Long> perfumeIds) {
        if (perfumeIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, String> thumbnails = new HashMap<>();
        for (PerfumeImageUrl candidate : perfumeImageRepository.findOrderedByPerfumeIds(perfumeIds)) {
            thumbnails.putIfAbsent(candidate.perfumeId(), candidate.imageUrl());
        }
        return thumbnails;
    }

    /**
     * 검색어를 쿼리에 넣을 수 있는 형태로 다듬습니다.
     *
     * <p>빈 문자열과 공백만 있는 검색어는 {@code null} 로 만들어 "검색어 없음"과 같게 다룹니다.
     * 정규화하지 않으면 {@code ?keyword=} 같은 요청이 공백을 포함한 이름만 찾게 됩니다.
     */
    /**
     * 진열대 필터가 있으면 사용자의 향수 번호로 범위를 좁혀 조회합니다.
     *
     * <p>번호가 하나도 없으면 조회하지 않고 빈 페이지를 만듭니다. 결과를 이미 알기 때문이며,
     * 목록과 개수 두 번의 질의를 아낍니다. 정확성을 위한 것은 아닙니다. 빈 컬렉션을 그대로
     * 넘겨도 Hibernate 가 항상 거짓인 조건으로 바꿔 주어 같은 결과가 나옵니다. 이 분기를 지워도
     * 실패하는 테스트가 없다는 것을 확인했습니다.
     */
    private Page<PerfumeSummaryResponse> findPage(
            ShelfFilter shelf, String keyword, String brand, String gender, Pageable pageable) {
        if (shelf == null) {
            return perfumeRepository.search(keyword, brand, gender, pageable);
        }

        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(
                        PerfumeErrorCode.PERFUME_SHELF_FILTER_REQUIRES_LOGIN));

        List<Long> perfumeIds = perfumeShelfRepository.findPerfumeIds(userId, shelf);
        if (perfumeIds.isEmpty()) {
            return Page.empty(pageable);
        }

        return perfumeRepository.searchWithinPerfumeIds(keyword, brand, gender, perfumeIds, pageable);
    }

    /**
     * 값이 없는 것과 공백만 있는 것을 똑같이 다룹니다. {@code ?brand=} 같은 요청이 공백 이름을
     * 가진 브랜드를 찾으러 가지 않게 합니다.
     */
    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalize(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return escapeLikeWildcards(keyword.trim());
    }

    /**
     * 사용자가 입력한 LIKE 와일드카드를 일반 문자로 만듭니다.
     *
     * <p>이스케이프하지 않으면 {@code %} 한 글자만 입력해도 모든 이름과 일치해 활성 향수 전체가
     * 조회됩니다. 검색어 없는 요청을 막아둔 의미가 사라지고, 데이터가 쌓이면 인덱스를 타지 못하는
     * 전체 조회가 됩니다.
     *
     * <p>이스케이프 문자 자신을 먼저 치환해야 합니다. 순서를 바꾸면 뒤 단계가 앞 단계에서 붙인
     * 이스케이프 문자를 다시 이스케이프합니다.
     */
    private String escapeLikeWildcards(String keyword) {
        String escape = PerfumeRepository.LIKE_ESCAPE;
        return keyword
                .replace(escape, escape + escape)
                .replace("%", escape + "%")
                .replace("_", escape + "_");
    }
}
