package com.hyanghae.backend.perfume.controller;

import com.hyanghae.backend.perfume.dto.request.PerfumeSearchCondition;
import com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse;
import com.hyanghae.backend.perfume.dto.response.RelatedPerfumesResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeNotesResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumePostsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewKeywordsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewStatisticsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewSummaryResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSeasonStatisticsResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSearchResponse;
import com.hyanghae.backend.perfume.service.PerfumeService;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/perfumes")
public class PerfumeController {

    private static final int DEFAULT_PAGE_SIZE = 20;

    private final PerfumeService perfumeService;

    public PerfumeController(PerfumeService perfumeService) {
        this.perfumeService = perfumeService;
    }

    /**
     * 향수명·브랜드명 검색과 필터입니다. 조건은 {@link PerfumeSearchCondition} 에 모읍니다.
     *
     * <p>조건은 모두 선택입니다. 하나도 주지 않으면 활성 향수 전체가 페이지 단위로 나갑니다.
     * 이 엔드포인트를 검색창과 향수 목록 화면이 함께 쓰고, 목록 화면은 필터를 걸기 전에도 향수가
     * 보여야 하기 때문입니다.
     *
     * <p>{@code shelf} 만 로그인이 필요합니다. 비로그인 요청에 오면 401 입니다.
     *
     * <p>{@code sort} 기본값을 지정한 이유가 있습니다. {@code ORDER BY} 없는 페이징은 데이터베이스가
     * 행 순서를 보장하지 않으므로, 2페이지에 1페이지 항목이 다시 나오거나 어떤 항목이 아예 조회되지
     * 않을 수 있습니다.
     */
    @GetMapping
    public PerfumeSearchResponse search(
            @ModelAttribute PerfumeSearchCondition condition,
            @PageableDefault(size = DEFAULT_PAGE_SIZE, sort = "id") Pageable pageable
    ) {
        return perfumeService.search(condition, pageable);
    }

    /**
     * 향수 기본 정보 조회입니다. 향조·후기·통계는 명세상 별도 엔드포인트로 제공합니다.
     */
    @GetMapping("/{perfumeId}")
    public PerfumeDetailResponse getDetail(@PathVariable Long perfumeId) {
        return perfumeService.getDetail(perfumeId);
    }

    /**
     * 향수 향조 조회입니다. 노트와 어코드를 함께 내려줍니다.
     */
    @GetMapping("/{perfumeId}/notes")
    public PerfumeNotesResponse getNotes(@PathVariable Long perfumeId) {
        return perfumeService.getNotes(perfumeId);
    }

    /**
     * 관련 게시글 조회입니다. 향수가 연결된 게시글을 최신순으로 내려줍니다.
     *
     * <p>명세의 Query Parameter 에 {@code size} 만 있지만 응답에 {@code page} 가 있어
     * {@code page} 도 받습니다. 없으면 2페이지 이후를 볼 방법이 없습니다. 검색과 같은 판단입니다.
     */
    @GetMapping("/{perfumeId}/posts")
    public PerfumePostsResponse getPosts(
            @PathVariable Long perfumeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return perfumeService.getPosts(perfumeId, page, size);
    }

    /**
     * 후기 키워드 통계 조회입니다. 후기에서 자주 나온 향 표현과 비중을 많이 나온 순으로 줍니다.
     *
     * <p>후기 수({@code review-statistics})와 나누어 둔 이유가 있습니다. 후기 수는 바로 셀 수
     * 있지만 키워드는 AI 가 적재한 뒤에야 값이 생깁니다. 성격이 다른 두 값을 한 응답에 묶으면
     * 한쪽이 늘 비어 있는 응답이 됩니다.
     */
    @GetMapping("/{perfumeId}/review-keywords")
    public PerfumeReviewKeywordsResponse getReviewKeywords(@PathVariable Long perfumeId) {
        return perfumeService.getReviewKeywords(perfumeId);
    }

    /** 향수 후기 통계 조회입니다. */
    @GetMapping("/{perfumeId}/review-statistics")
    public PerfumeReviewStatisticsResponse getReviewStatistics(@PathVariable Long perfumeId) {
        return perfumeService.getReviewStatistics(perfumeId);
    }

    /**
     * 주변 향수 조회입니다. 향수 데이터를 넣을 때 미리 정해 둔 연관 향수를 읽어 옵니다.
     *
     * <p>{@code size} 는 페이지 크기가 아니라 최대 개수입니다. 명세에 {@code page} 와
     * {@code totalElements} 가 없어 나머지를 이어서 볼 방법이 없습니다.
     */
    @GetMapping("/{perfumeId}/neighbors")
    public RelatedPerfumesResponse getNeighbors(
            @PathVariable Long perfumeId,
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return perfumeService.getRelatedPerfumes(perfumeId, size);
    }

    /**
     * 유사 향수 조회입니다. 주변 향수와 같은 데이터를 같은 형태로 내려줍니다.
     *
     * <p>화면에서 놓이는 자리가 달라 명세가 URL 을 두 개로 나눠 두었습니다. 응답이 같으므로
     * 서비스 메서드도 같은 것을 씁니다. 나중에 근거가 갈리면 그때 나누면 됩니다.
     */
    @GetMapping("/{perfumeId}/similar")
    public RelatedPerfumesResponse getSimilar(
            @PathVariable Long perfumeId,
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return perfumeService.getRelatedPerfumes(perfumeId, size);
    }

    /** AI 후기 요약 조회입니다. 요약이 없으면 필드가 모두 null 입니다. */
    @GetMapping("/{perfumeId}/review-summary")
    public PerfumeReviewSummaryResponse getReviewSummary(@PathVariable Long perfumeId) {
        return perfumeService.getReviewSummary(perfumeId);
    }

    /** 향수 계절 통계 조회입니다. 후기가 고른 계절의 분포입니다. */
    @GetMapping("/{perfumeId}/season-statistics")
    public PerfumeSeasonStatisticsResponse getSeasonStatistics(@PathVariable Long perfumeId) {
        return perfumeService.getSeasonStatistics(perfumeId);
    }
}
