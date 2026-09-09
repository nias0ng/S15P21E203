package com.hyanghae.backend.perfume.controller;

import com.hyanghae.backend.perfume.dto.request.PerfumeSearchCondition;
import com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSearchResponse;
import com.hyanghae.backend.perfume.service.PerfumeService;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
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
}
