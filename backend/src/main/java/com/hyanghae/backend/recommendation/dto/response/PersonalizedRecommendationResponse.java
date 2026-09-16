package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/** 한 번에 향수 하나를 돌려주는 개인화 추천 응답입니다. */
public record PersonalizedRecommendationResponse(

        @Schema(description = "진열대 사이드 모달에 표시할 개인화 추천입니다.")
        PersonalizedPerfumeResponse recommendation
) {
}
