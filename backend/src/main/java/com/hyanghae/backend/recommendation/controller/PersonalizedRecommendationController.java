package com.hyanghae.backend.recommendation.controller;

import com.hyanghae.backend.recommendation.dto.response.PersonalizedRecommendationResponse;
import com.hyanghae.backend.recommendation.service.PersonalizedRecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인 사용자의 취향에 맞는 향수 한 개를 추천합니다. */
@Tag(name = "개인화 추천", description = "취향과 최근 관심으로 새로운 향수를 추천합니다.")
@RestController
@RequestMapping("/api/v1/recommendations")
public class PersonalizedRecommendationController {

    private final PersonalizedRecommendationService recommendationService;

    public PersonalizedRecommendationController(
            PersonalizedRecommendationService recommendationService
    ) {
        this.recommendationService = recommendationService;
    }

    @Operation(summary = "개인화 향수 추천",
            description = "취향 테스트, 적합도 평가, 최근 조회를 반영해 향수 하나를 추천하고 "
                    + "노출 기록을 저장합니다.")
    @ApiResponse(responseCode = "200", description = "개인화 추천 한 건입니다.")
    @ApiResponse(responseCode = "400", description = "취향 테스트를 먼저 완료해야 합니다.")
    @ApiResponse(responseCode = "401", description = "로그인이 필요합니다.")
    @ApiResponse(responseCode = "404", description = "추천할 수 있는 향수가 없습니다.")
    @GetMapping("/personalized")
    public PersonalizedRecommendationResponse recommend() {
        return recommendationService.recommend();
    }
}
