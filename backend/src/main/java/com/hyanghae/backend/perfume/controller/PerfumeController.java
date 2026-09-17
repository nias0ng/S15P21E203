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
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "향수", description = "향수 정보와 향조·후기 통계를 조회합니다.")
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
     * <p>브랜드로 거르는 방법이 둘입니다. {@code brandId} 는 번호로, {@code brand} 는 이름
     * 완전 일치로 겁니다. <b>번호를 권합니다</b> — 브랜드 이름은 한글과 영문이 섞여 있고 표기만
     * 다른 중복도 있어 화면이 가진 이름이 저장된 이름과 어긋날 수 있습니다. 브랜드 목록
     * ({@code GET /api/v1/brands})이 번호를 함께 주므로 그대로 넘기면 됩니다.
     *
     * <p>{@code ranking} 은 전체 사용자 집계 기준입니다. 사람들이 많이 담거나 열어 본 순으로
     * 줄 세웁니다. <b>OWNED·WISH 는 세 명 이상이 담은 향수만 나오고, VIEWED 는 하한이 없습니다.</b>
     * 기준에 못 미치는 향수를 0 건으로 뒤에 붙이면 카탈로그 전체가 향수 번호순으로 따라옵니다.
     *
     * <p>{@code sort} 기본값을 지정한 이유가 있습니다. {@code ORDER BY} 없는 페이징은 데이터베이스가
     * 행 순서를 보장하지 않으므로, 2페이지에 1페이지 항목이 다시 나오거나 어떤 항목이 아예 조회되지
     * 않을 수 있습니다.
     *
     * <p><b>{@code ranking} 이 있으면 {@code sort} 는 무시됩니다.</b> 이 값이 답하는 질문 자체가
     * "사람들이 많이 담은 향수"라서 다른 정렬을 둘 자리가 없습니다. 같은 횟수면 향수 번호순이라
     * 페이지를 넘겨도 순서가 흔들리지 않습니다.
     */
    @Operation(
            summary = "향수 검색",
            description = "조건은 모두 선택입니다. 하나도 주지 않으면 활성 향수 전체가"
                    + " 페이지로 나갑니다. 브랜드는 이름(brand)보다 번호(brandId)를 권합니다"
                    + " — 표기가 다른 중복 브랜드가 있어 이름은 어긋날 수 있습니다."
                    + " ranking 을 주면 sort 는 무시됩니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @GetMapping
    public PerfumeSearchResponse search(
            @ModelAttribute PerfumeSearchCondition condition,
            @PageableDefault(size = DEFAULT_PAGE_SIZE, sort = "id") Pageable pageable
    ) {
        return perfumeService.search(condition, pageable);
    }

    /**
     * 향수 기본 정보 조회입니다. 향조·후기·통계는 명세상 별도 엔드포인트로 제공합니다.
     *
     * <p>로그인하면 {@code myReviewId} 가 함께 나갑니다. 화면이 [후기 쓰기] 와 [후기 수정] 중
     * 무엇을 띄울지 정하는 값입니다. 한 사람은 한 향수에 후기를 하나만 가질 수 있어, 이미 쓴
     * 향수에 또 쓰려 하면 409 가 납니다.
     */
    @Operation(
            summary = "향수 기본 정보 조회",
            description = "로그인 없이 조회할 수 있습니다. 로그인한 경우 이 향수에 내가 쓴 후기가"
                    + " 있으면 myReviewId 가 함께 나갑니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
    @GetMapping("/{perfumeId}")
    public PerfumeDetailResponse getDetail(@PathVariable Long perfumeId) {
        return perfumeService.getDetail(perfumeId);
    }

    /**
     * 향수 향조 조회입니다. 노트와 어코드를 함께 내려줍니다.
     */
    @Operation(summary = "향수 향조 조회", description = "노트와 어코드를 함께 돌려줍니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
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
    @Operation(summary = "관련 게시글 조회",
            description = "이 향수가 연결된 게시글을 최신순으로 돌려줍니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
    @GetMapping("/{perfumeId}/posts")
    public PerfumePostsResponse getPosts(
            @PathVariable Long perfumeId,
            @Parameter(description = "0부터 시작하는 페이지 번호")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "페이지 크기")
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
     *
     * <p>{@code size} 는 페이지 크기가 아니라 최대 개수입니다. 주변·유사 향수와 같은 뜻으로
     * 씁니다. 상위 세 개만 필요한 화면은 {@code ?size=3} 으로 부릅니다. 많이 나온 순이고 같은
     * 횟수면 이름순이라 앞에서 자른 결과가 매번 같습니다.
     *
     * <p>몇 개를 받든 각 키워드의 백분율은 같습니다. 분모가 "키워드가 하나라도 뽑힌 후기 수"로
     * 따로 세어지기 때문입니다. 그래서 화면 문구는 "향을 언급한 후기 중 몇 퍼센트"가 됩니다.
     * 향수에 달린 모든 후기를 분모로 읽으면 실제보다 큰 숫자를 말하게 됩니다.
     */
    @Operation(
            summary = "후기 키워드 통계 조회",
            description = "후기에서 자주 나온 향 표현과 비중을 많이 나온 순으로 돌려줍니다."
                    + " 백분율의 분모는 향수에 달린 전체 후기가 아니라 키워드가 하나라도"
                    + " 뽑힌 후기 수입니다. 그래서 몇 개를 받든 각 키워드의 비율은 같습니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
    @GetMapping("/{perfumeId}/review-keywords")
    public PerfumeReviewKeywordsResponse getReviewKeywords(
            @PathVariable Long perfumeId,
            @Parameter(description = "받을 최대 개수. 페이지 크기가 아니라 상한입니다.")
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return perfumeService.getReviewKeywords(perfumeId, size);
    }

    /** 향수 후기 통계 조회입니다. */
    @Operation(summary = "향수 후기 통계 조회", description = "후기 수와 평점 분포입니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
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
    @Operation(summary = "주변 향수 조회",
            description = "향수 데이터를 넣을 때 미리 정해 둔 연관 향수입니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
    @GetMapping("/{perfumeId}/neighbors")
    public RelatedPerfumesResponse getNeighbors(
            @PathVariable Long perfumeId,
            @Parameter(description = "받을 최대 개수. 페이지 크기가 아니라 상한입니다.")
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
    @Operation(summary = "유사 향수 조회",
            description = "주변 향수와 같은 데이터를 같은 형태로 돌려줍니다."
                    + " 화면에서 놓이는 자리가 달라 경로만 나뉘어 있습니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
    @GetMapping("/{perfumeId}/similar")
    public RelatedPerfumesResponse getSimilar(
            @PathVariable Long perfumeId,
            @Parameter(description = "받을 최대 개수. 페이지 크기가 아니라 상한입니다.")
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return perfumeService.getRelatedPerfumes(perfumeId, size);
    }

    /** AI 후기 요약 조회입니다. 요약이 없으면 필드가 모두 null 입니다. */
    @Operation(summary = "AI 후기 요약 조회",
            description = "요약이 아직 만들어지지 않았으면 필드가 모두 null 입니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
    @GetMapping("/{perfumeId}/review-summary")
    public PerfumeReviewSummaryResponse getReviewSummary(@PathVariable Long perfumeId) {
        return perfumeService.getReviewSummary(perfumeId);
    }

    /** 향수 계절 통계 조회입니다. 후기가 고른 계절의 분포입니다. */
    @Operation(summary = "향수 계절 통계 조회",
            description = "후기 작성자가 고른 계절의 분포입니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
    @GetMapping("/{perfumeId}/season-statistics")
    public PerfumeSeasonStatisticsResponse getSeasonStatistics(@PathVariable Long perfumeId) {
        return perfumeService.getSeasonStatistics(perfumeId);
    }
}
