package com.hyanghae.backend.recommendation.controller;

import com.hyanghae.backend.recommendation.dto.request.NaturalLanguageRecommendationRequest;
import com.hyanghae.backend.recommendation.dto.response.NaturalLanguageRecommendationResponse;
import com.hyanghae.backend.recommendation.service.NaturalLanguageRecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 한국어 문장으로 향수를 추천합니다 (요구사항 NLR-01).
 *
 * <p><i>"빨래 냄새 나는 향수 찾고 있어"</i> 같은 문장을 받아 향수 다섯 개까지와 각각의 추천
 * 이유를 돌려줍니다. 문장을 향 조건으로 바꾸고 향수를 찾는 일은 AI 서버가 하고, 이 백엔드는
 * 그 결과를 우리 DB 의 향수로 바꿔 화면이 쓸 모양으로 조립합니다.
 *
 * <p><b>비회원도 부를 수 있습니다.</b> 로그인 여부가 결과에 영향을 주지 않습니다.
 *
 * <p>조회인데 {@code POST} 입니다. 사용자가 쓴 문장이 최대 500자라 쿼리스트링에 담기 어렵고,
 * 담으면 그 문장이 접근 로그에 그대로 남습니다.
 *
 * <p>경로가 {@code /recommendations/natural-language} 인 것은 추천 방식이 더 생기기 때문입니다.
 * 개인화 추천(REC-12·REC-13)이 같은 묶음 아래로 들어옵니다.
 */
@Tag(name = "자연어 추천", description = "한국어 문장으로 향수를 추천합니다.")
@RestController
@RequestMapping("/api/v1/recommendations")
public class NaturalLanguageRecommendationController {

    private final NaturalLanguageRecommendationService recommendationService;

    public NaturalLanguageRecommendationController(
            NaturalLanguageRecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    /**
     * 문장 하나로 향수를 추천합니다.
     *
     * <p>응답의 {@code status} 네 가지를 화면이 구분해야 합니다. 특히 향수가 0개인 경우가 두
     * 종류이고({@code NO_CONDITION}·{@code NO_RESULT}) 사용자에게 할 말이 다릅니다.
     *
     * <p><b>결과가 0개일 때 인기 향수를 대신 보여주면 안 됩니다.</b> 추천처럼 보이지만 근거가
     * 없어 요구사항 NLR-07(추천 이유 제공)을 어깁니다.
     *
     * <p>AI 서버가 죽으면 이 엔드포인트만 503 입니다. 다른 기능은 그대로 동작합니다.
     */
    @Operation(summary = "자연어 추천",
            description = "한국어 문장을 받아 향수 5개까지와 각각의 추천 이유를 돌려줍니다. "
                    + "향수를 못 찾아도 200 이고, status 로 구분합니다.")
    @ApiResponse(responseCode = "200",
            description = "추천 결과입니다. 향수가 0개일 수 있으며 status 로 구분합니다.")
    @ApiResponse(responseCode = "400", description = "query 가 비었거나 500자를 넘었습니다.")
    @ApiResponse(responseCode = "503", description = "AI 서버가 응답하지 않습니다.")
    @PostMapping("/natural-language")
    public NaturalLanguageRecommendationResponse recommend(
            @Valid @RequestBody NaturalLanguageRecommendationRequest request) {
        return recommendationService.recommend(request.query());
    }
}
