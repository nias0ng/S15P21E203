package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/** 한 번에 향수 하나를 돌려주는 개인화 추천 응답입니다. */
public record PersonalizedRecommendationResponse(

        @Schema(description = "실제 노출 완료를 기록할 때 보내는 일회성 추천 토큰입니다.")
        UUID recommendationToken,

        @Schema(description = "진열대 사이드 모달에 표시할 개인화 추천입니다.")
        PersonalizedPerfumeResponse recommendation
) {
}
