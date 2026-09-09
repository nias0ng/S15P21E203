package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.perfume.dto.request.PerfumeSearchCondition;
import com.hyanghae.backend.perfume.dto.request.ShelfFilter;
import com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeNotesResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumePostResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumePostsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewKeywordResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewKeywordsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewStatisticsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewSummaryResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSeasonStatisticResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSeasonStatisticsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSearchResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse;
import com.hyanghae.backend.perfume.dto.response.RelatedPerfumeResponse;
import com.hyanghae.backend.perfume.dto.response.RelatedPerfumesResponse;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.perfume.repository.PerfumeScentFamilyRepository;
import com.hyanghae.backend.perfume.repository.PerfumeShelfRepository;
import com.hyanghae.backend.perfume.dto.response.PerfumePriceResponse;
import com.hyanghae.backend.perfume.repository.PerfumeAccordRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.perfume.repository.PerfumeNeighborRepository;
import com.hyanghae.backend.perfume.repository.PerfumeNoteRepository;
import com.hyanghae.backend.perfume.repository.PerfumePostRepository;
import com.hyanghae.backend.perfume.repository.PerfumeReviewKeywordRepository;
import com.hyanghae.backend.perfume.repository.PerfumeReviewRepository;
import com.hyanghae.backend.perfume.repository.PerfumeReviewSummaryRepository;
import com.hyanghae.backend.perfume.repository.PerfumePriceRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PerfumeService {

    /** 백분율의 소수점 자리수입니다. 정수로 반올림하면 3분의 1 이 33 이 되어 값이 뭉개집니다. */
    private static final int PERCENTAGE_SCALE = 1;

    /** 비율을 백분율로 바꿀 때 곱하는 값입니다. */
    private static final BigDecimal PERCENTAGE_MULTIPLIER = BigDecimal.valueOf(100);

    /** 목록 하나에 한 번에 내려주는 최대 개수입니다. 요청이 이보다 크면 여기까지만 줍니다. */
    private static final int MAX_PAGE_SIZE = 100;

    private final PerfumeRepository perfumeRepository;
    private final PerfumeImageRepository perfumeImageRepository;
    private final PerfumePriceRepository perfumePriceRepository;
    private final PerfumeScentFamilyRepository perfumeScentFamilyRepository;
    private final PerfumeShelfRepository perfumeShelfRepository;
    private final PerfumeNoteRepository perfumeNoteRepository;
    private final PerfumeAccordRepository perfumeAccordRepository;
    private final PerfumeReviewRepository perfumeReviewRepository;
    private final PerfumeReviewKeywordRepository perfumeReviewKeywordRepository;
    private final PerfumeReviewSummaryRepository perfumeReviewSummaryRepository;
    private final PerfumePostRepository perfumePostRepository;
    private final PerfumeNeighborRepository perfumeNeighborRepository;

    public PerfumeService(
            PerfumeRepository perfumeRepository,
            PerfumeImageRepository perfumeImageRepository,
            PerfumePriceRepository perfumePriceRepository,
            PerfumeScentFamilyRepository perfumeScentFamilyRepository,
            PerfumeShelfRepository perfumeShelfRepository,
            PerfumeNoteRepository perfumeNoteRepository,
            PerfumeAccordRepository perfumeAccordRepository,
            PerfumeReviewRepository perfumeReviewRepository,
            PerfumeReviewKeywordRepository perfumeReviewKeywordRepository,
            PerfumeReviewSummaryRepository perfumeReviewSummaryRepository,
            PerfumePostRepository perfumePostRepository,
            PerfumeNeighborRepository perfumeNeighborRepository
    ) {
        this.perfumeRepository = perfumeRepository;
        this.perfumeImageRepository = perfumeImageRepository;
        this.perfumePriceRepository = perfumePriceRepository;
        this.perfumeScentFamilyRepository = perfumeScentFamilyRepository;
        this.perfumeShelfRepository = perfumeShelfRepository;
        this.perfumeNoteRepository = perfumeNoteRepository;
        this.perfumeAccordRepository = perfumeAccordRepository;
        this.perfumeReviewRepository = perfumeReviewRepository;
        this.perfumeReviewKeywordRepository = perfumeReviewKeywordRepository;
        this.perfumeReviewSummaryRepository = perfumeReviewSummaryRepository;
        this.perfumePostRepository = perfumePostRepository;
        this.perfumeNeighborRepository = perfumeNeighborRepository;
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
     * <p>진열대 필터는 전체 사용자 집계입니다. "내가 담은 향수"가 아니라 "사람들이 담은 향수"라서
     * 로그인이 필요 없습니다.
     *
     * <p>격리 수준을 {@code REPEATABLE_READ} 로 올린 이유는 관련 게시글 조회와 같습니다. 목록과
     * 전체 개수를 두 번의 쿼리로 얻는데, 기본값인 {@code READ COMMITTED} 는 문장마다 새 스냅샷을
     * 잡아 두 값이 어긋날 수 있습니다.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
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

    /**
     * 후기에서 자주 나온 향 표현과 그 비중입니다.
     *
     * <p>분모는 키워드가 하나라도 뽑힌 후기 수입니다. 후기 하나에서 키워드가 여러 개 나올 수 있어
     * 백분율의 합이 100 을 넘을 수 있습니다. 계절 통계와 같은 성질입니다.
     *
     * <p>키워드가 없는 향수는 빈 배열입니다. 없는 향수와 구분해야 하므로 존재하지 않는 향수에만
     * 404 를 반환합니다. 키워드를 뽑는 파이프라인이 아직 없어 현재는 모든 향수가 빈 배열입니다.
     */
    @Transactional(readOnly = true)
    public PerfumeReviewKeywordsResponse getReviewKeywords(Long perfumeId) {
        requireExistingPerfume(perfumeId);

        long reviewsWithKeyword =
                perfumeReviewKeywordRepository.countReviewsWithKeywordByPerfumeId(perfumeId);

        return new PerfumeReviewKeywordsResponse(
                perfumeReviewKeywordRepository.findKeywordCountsByPerfumeId(perfumeId).stream()
                        .map(keyword -> new PerfumeReviewKeywordResponse(
                                keyword.keyword(),
                                percentageOf(keyword.count(), reviewsWithKeyword)
                        ))
                        .toList()
        );
    }

    /**
     * 향수의 후기 수를 반환합니다.
     *
     * <p>이 수는 화면 표시용이면서, AI 후기 요약을 다시 만들 시점을 판단하는 기준입니다. 후기가
     * 일정 개수 쌓일 때마다 요약을 새로 생성하기로 했으므로, 여기서 세는 수와 요약이 들고 있는
     * {@code sourceReviewCount} 의 차이가 곧 "요약 이후 새로 쌓인 후기 수"입니다.
     *
     * <p>그래서 두 수는 반드시 같은 기준으로 세야 합니다. 지금은 양쪽 다 향수에 달린 모든
     * 후기이므로 어긋날 여지가 없습니다.
     */
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
                                percentageOf(season.count(), reviewsWithSeason)
                        ))
                        .toList()
        );
    }

    /**
     * AI 가 생성한 후기 요약을 반환합니다.
     *
     * <p>요약이 없는 향수는 필드가 모두 {@code null} 인 200 응답입니다. 404 로 하면 향수 자체가
     * 없는 경우와 구분되지 않습니다. 요약을 생성하는 파이프라인이 아직 없어 현재는 모든 향수가
     * 빈 응답입니다.
     */
    @Transactional(readOnly = true)
    public PerfumeReviewSummaryResponse getReviewSummary(Long perfumeId) {
        requireExistingPerfume(perfumeId);

        return perfumeReviewSummaryRepository.findResponseByPerfumeId(perfumeId)
                .orElseGet(PerfumeReviewSummaryResponse::empty);
    }

    /**
     * 향수가 연결된 게시글을 최신순으로 가져옵니다.
     *
     * <p>게시글이 없는 향수는 빈 목록입니다. 없는 향수와 구분해야 하므로 존재하지 않는 향수에만
     * 404 를 반환합니다.
     *
     * <p>페이지 번호와 크기가 범위를 벗어나도 예외 대신 허용 범위로 맞춥니다. 음수 페이지는
     * {@code OFFSET} 을 음수로 만들어 SQL 오류가 되는데, 목록 위치가 잘못됐다고 서버 오류를
     * 낼 일은 아닙니다.
     *
     * <p>개수 조회를 따로 한 번 더 합니다. 명세가 {@code totalElements} 를 요구하기 때문입니다.
     *
     * <p>격리 수준을 {@code REPEATABLE_READ} 로 올린 이유가 있습니다. 기본값인
     * {@code READ COMMITTED} 는 문장마다 새 스냅샷을 잡습니다. 목록을 읽은 뒤 개수를 세기까지
     * 사이에 게시글이 추가되거나 지워지면 두 값이 어긋나, 목록에 없는 건수가 {@code totalElements}
     * 에 잡힙니다. {@code REPEATABLE_READ} 는 트랜잭션의 첫 문장에서 스냅샷을 한 번 잡고 끝까지
     * 유지하므로 두 쿼리가 같은 시점을 봅니다.
     *
     * <p>읽기 전용이라 직렬화 실패는 나지 않습니다. 쓰기 트랜잭션에서만 생기는 문제입니다.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PerfumePostsResponse getPosts(Long perfumeId, int page, int size) {
        requireExistingPerfume(perfumeId);

        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);

        List<PerfumePostResponse> posts = perfumePostRepository.findPageByPerfumeId(
                perfumeId, pageSize, (long) pageNumber * pageSize);

        return new PerfumePostsResponse(
                posts, pageNumber, pageSize, perfumePostRepository.countByPerfumeId(perfumeId));
    }

    /**
     * 기준 향수와 이어진 향수들을 가져옵니다. 주변 향수와 유사 향수가 이 메서드를 함께 씁니다.
     *
     * <p>두 API 는 같은 {@code perfume_neighbors} 데이터를 읽습니다. 화면에서 놓이는 자리만
     * 다릅니다. 나중에 근거가 갈리면 그때 메서드를 나누면 됩니다.
     *
     * <p>연관 관계는 계산하지 않습니다. 향수 데이터를 넣을 때 미리 정해진 쌍을 읽을 뿐입니다.
     *
     * <p>{@code size} 는 페이지 크기가 아니라 앞에서 몇 개까지 줄지입니다. 응답에 전체 개수와
     * 페이지 번호가 없어 나머지를 이어서 볼 방법이 없기 때문입니다. 0 이하거나 지나치게 큰 값이
     * 와도 예외 대신 허용 범위로 맞춥니다. 목록 길이는 요청이 틀렸다고 거절할 만한 값이 아닙니다.
     *
     * <p>이웃이 없는 향수는 빈 목록입니다. 없는 향수와 구분해야 하므로 존재하지 않는 향수에만
     * 404 를 반환합니다.
     */
    @Transactional(readOnly = true)
    public RelatedPerfumesResponse getRelatedPerfumes(Long perfumeId, int size) {
        requireExistingPerfume(perfumeId);

        List<RelatedPerfumeResponse> related = perfumeNeighborRepository.findNeighborsByPerfumeId(
                perfumeId, PageRequest.of(0, Math.clamp(size, 1, MAX_PAGE_SIZE)));
        Map<Long, String> images = loadThumbnails(
                related.stream().map(RelatedPerfumeResponse::perfumeId).toList()
        );

        return new RelatedPerfumesResponse(
                related.stream()
                        .map(perfume -> perfume.withImageUrl(images.get(perfume.perfumeId())))
                        .toList()
        );
    }

    /**
     * 0 이상 100 이하의 백분율입니다. 분모가 0 이면 나눗셈 대신 0 을 씁니다. 후기가 없거나
     * 아무도 계절을 고르지 않은 경우입니다.
     *
     * <p>나누기 전에 100 을 곱합니다. 먼저 나누면 소수점 아래에서 반올림한 값을 다시 100 배 해
     * 오차가 100 배로 커집니다.
     */
    private BigDecimal percentageOf(long count, long total) {
        if (total == 0) {
            return BigDecimal.ZERO.setScale(PERCENTAGE_SCALE);
        }
        return BigDecimal.valueOf(count)
                .multiply(PERCENTAGE_MULTIPLIER)
                .divide(BigDecimal.valueOf(total), PERCENTAGE_SCALE, RoundingMode.HALF_UP);
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
     * 진열대 필터가 있으면 사람들이 담거나 열어 본 향수로 범위를 좁혀 조회합니다.
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

        List<Long> perfumeIds = perfumeShelfRepository.findPerfumeIds(shelf);
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
