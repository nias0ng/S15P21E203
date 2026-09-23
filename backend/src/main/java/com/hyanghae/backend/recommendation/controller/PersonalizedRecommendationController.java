package com.hyanghae.backend.recommendation.controller;

import com.hyanghae.backend.recommendation.dto.response.PersonalizedRecommendationResponse;
import com.hyanghae.backend.recommendation.service.PersonalizedRecommendationExposureService;
import com.hyanghae.backend.recommendation.service.PersonalizedRecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 로그인 사용자의 취향에 맞는 향수 한 개를 추천합니다. */
@Tag(name = "개인화 추천", description = "취향과 최근 관심으로 새로운 향수를 추천합니다.")
@RestController
@RequestMapping("/api/v1/recommendations")
public class PersonalizedRecommendationController {

    private final PersonalizedRecommendationService recommendationService;
    private final PersonalizedRecommendationExposureService exposureService;

    public PersonalizedRecommendationController(
            PersonalizedRecommendationService recommendationService,
            PersonalizedRecommendationExposureService exposureService
    ) {
        this.recommendationService = recommendationService;
        this.exposureService = exposureService;
    }

    @Operation(summary = "개인화 향수 추천",
            description = "취향 테스트, 적합도 평가, 최근 조회를 반영해 향수 하나와 노출 완료용 "
                    + "토큰을 반환합니다. 조회만으로는 노출 이력을 저장하지 않습니다.")
    @ApiResponse(responseCode = "200", description = "개인화 추천 한 건입니다.")
    @ApiResponse(responseCode = "400", description = "취향 테스트를 먼저 완료해야 합니다.")
    @ApiResponse(responseCode = "401", description = "로그인이 필요합니다.")
    @ApiResponse(responseCode = "404", description = "추천할 수 있는 향수가 없습니다.")
    @ApiResponse(responseCode = "409", description = "같은 사용자의 추천을 계산하고 있습니다.")
    @ApiResponse(responseCode = "503", description = "추천 후보를 계산할 수 없습니다.")
    @GetMapping("/personalized")
    public PersonalizedRecommendationResponse recommend() {
        return recommendationService.recommend();
    }

    @Operation(summary = "개인화 추천 노출 완료",
            description = "추천이 실제 화면에 표시된 뒤 조회 응답의 토큰으로 노출을 기록합니다. "
                    + "같은 토큰을 다시 보내도 노출은 한 번만 저장됩니다.")
    @ApiResponse(responseCode = "204", description = "노출 기록을 완료했거나 이미 기록했습니다.")
    @ApiResponse(responseCode = "401", description = "로그인이 필요합니다.")
    @ApiResponse(responseCode = "404", description = "내 추천 토큰이 아니거나 없거나 만료됐습니다.")
    @PostMapping("/personalized/{recommendationToken}/exposure")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void completeExposure(
            @Parameter(description = "추천 조회 응답의 recommendationToken")
            @PathVariable UUID recommendationToken
    ) {
        exposureService.complete(recommendationToken);
    }
}
