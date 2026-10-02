package com.hyanghae.backend.taste.controller;

import com.hyanghae.backend.taste.dto.request.TasteTestCreateRequest;
import com.hyanghae.backend.taste.dto.response.TasteTestResponse;
import com.hyanghae.backend.taste.service.TasteTestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 회원가입 뒤 첫 로그인에 한 번 치르는 취향 테스트입니다.
 *
 * <p>향 계열 아홉 개 중 1~2개를 순위를 매겨 고르면 향 지도 위 향수 한 개가 뽑히고, 그 향수가
 * 배의 첫 자리가 됩니다. 추천이 아무것도 모르는 상태로 시작하지 않게 하려는 것입니다.
 *
 * <p>경로가 {@code /api/v1/users/me} 아래입니다. 기록이 사용자에게 매달려 있어 내 컬렉션·내
 * 진열대와 같은 자리에 둡니다.
 *
 * <p>고를 계열과 결과 향수 후보는 {@code GET /api/v1/map/scent-vectors} 로 받습니다. 화면이
 * 그 값으로 유사도를 재서 결과 향수를 정합니다.
 */
@Tag(name = "취향 테스트", description = "회원가입 뒤 한 번 치르는 취향 테스트입니다.")
@RestController
@RequestMapping("/api/v1/users/me/taste-test")
public class TasteTestController {

    private final TasteTestService tasteTestService;

    public TasteTestController(TasteTestService tasteTestService) {
        this.tasteTestService = tasteTestService;
    }

    /**
     * 테스트를 마쳤다고 남깁니다. 배가 결과 향수 자리에 뜹니다.
     *
     * <p>{@code picks} 는 순서가 순위입니다. 첫 번째가 1순위입니다.
     *
     * <p>이미 마친 회원은 409 입니다. 한 번만 치르기 때문입니다.
     */
    @Operation(summary = "취향 테스트 저장",
            description = "고른 향 계열과 결과 향수를 남기고 배를 그 자리에 띄웁니다.")
    @ApiResponse(responseCode = "201", description = "저장했습니다.")
    @ApiResponse(responseCode = "400",
            description = "고른 계열이 1~2개가 아니거나, 없는 계열이거나, 결과 향수가 지도에 없거나,"
                    + " 결과 향수가 1순위 계열의 이름표 조각 밖에 있습니다"
                    + " (TASTE_PERFUME_OUTSIDE_PRIMARY_REGION).")
    @ApiResponse(responseCode = "401", description = "로그인이 필요합니다.")
    @ApiResponse(responseCode = "409", description = "이미 취향 테스트를 마쳤습니다.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TasteTestResponse complete(@Valid @RequestBody TasteTestCreateRequest request) {
        return tasteTestService.complete(request);
    }

    /**
     * 내 취향 테스트 기록입니다. 화면이 온보딩을 띄울지 여기서 판단합니다.
     *
     * <p>아직 치르지 않았으면 {@code completed} 가 {@code false} 인 200 입니다. 404 가 아닙니다.
     */
    @Operation(summary = "내 취향 테스트 조회",
            description = "마쳤는지, 무엇을 골랐는지, 결과 향수가 어디인지 돌려줍니다.")
    @ApiResponse(responseCode = "200",
            description = "기록입니다. 아직 치르지 않았으면 completed 가 false 입니다.")
    @ApiResponse(responseCode = "401", description = "로그인이 필요합니다.")
    @GetMapping
    public TasteTestResponse getMine() {
        return tasteTestService.findMine();
    }
}
