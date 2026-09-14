package com.hyanghae.backend.perfume.controller;

import com.hyanghae.backend.perfume.dto.response.BrandsResponse;
import com.hyanghae.backend.perfume.repository.BrandSort;
import com.hyanghae.backend.perfume.service.BrandService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 브랜드 페이지입니다(와이어프레임 A34).
 *
 * <p>브랜드는 향수에 매달리는 자료라 {@code perfume} 도메인에 둡니다. {@code Brand} 엔티티와
 * 향수 검색의 브랜드 필터가 이미 여기 있습니다.
 *
 * <p>경로를 {@code /api/v1/perfumes} 아래가 아니라 따로 둡니다. 브랜드가 향수에 딸린 자료가
 * 아니라 그 자체로 목록이 되는 자원이기 때문입니다. 카드를 누르면
 * {@code /api/v1/perfumes?brand=} 로 넘어가 향수 목록이 걸립니다.
 *
 * <p>로그인이 필요 없습니다. 브랜드 페이지는 누구나 볼 수 있어야 합니다.
 */
@Tag(name = "브랜드", description = "브랜드 목록을 조회합니다.")
@RestController
@RequestMapping("/api/v1/brands")
public class BrandController {

    private final BrandService brandService;

    public BrandController(BrandService brandService) {
        this.brandService = brandService;
    }

    /**
     * 브랜드 전체입니다. 페이지가 없습니다.
     *
     * <p>화면이 전부를 한 번에 뿌립니다. 브랜드 수는 향수처럼 늘어나는 값이 아닙니다.
     *
     * <p>검색어는 <b>한국어와 영문 이름 모두</b>에서 부분 일치로 찾습니다. 대소문자는 가리지
     * 않습니다. 검색창이 하나라 어느 쪽으로 쳐도 걸려야 합니다.
     *
     * <p>내려간 브랜드는 나오지 않습니다. 향수가 하나도 없는 브랜드는 나옵니다 — 브랜드 페이지는
     * 카탈로그라서, 향수가 잠깐 0이 됐다고 브랜드가 사라지면 이상합니다.
     */
    @Operation(
            summary = "브랜드 목록",
            description = "브랜드 전체를 한 번에 내려줍니다. 페이지가 없습니다. 검색어는 한국어와"
                    + " 영문 이름 모두에서 부분 일치로 찾습니다. 로그인 없이 조회할 수 있습니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "정렬 기준이 올바르지 않음")
    @GetMapping
    public BrandsResponse getBrands(
            @Parameter(description = "이름 검색어. 주지 않으면 전체", example = "말론")
            @RequestParam(required = false) String keyword,

            @Parameter(description = "정렬 기준. NAME_KO(한국어 이름순) · NAME_EN(영어 이름순)"
                    + " · PERFUME_COUNT(향수 많은 순)")
            @RequestParam(defaultValue = "NAME_EN") BrandSort sort
    ) {
        return brandService.findAll(keyword, sort);
    }
}
