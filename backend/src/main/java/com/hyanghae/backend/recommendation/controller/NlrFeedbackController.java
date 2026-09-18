package com.hyanghae.backend.recommendation.controller;

import com.hyanghae.backend.recommendation.dto.request.NlrClickRequest;
import com.hyanghae.backend.recommendation.dto.request.NlrFeedbackRequest;
import com.hyanghae.backend.recommendation.service.NlrFeedbackService;
import com.hyanghae.backend.recommendation.service.RecommendationRateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 자연어 추천을 받은 뒤의 행동을 받습니다.
 *
 * <p>추천 응답의 {@code recommendationToken} 으로 보냅니다. 그 값이 {@code null} 로 왔다면
 * 기록에 실패한 요청이라 여기에 보낼 것이 없습니다.
 *
 * <p><b>번호가 아니라 손잡이를 받습니다.</b> 내부 번호는 1부터 차례로 붙어, 그것을 받으면 1부터
 * 세기만 해도 남의 추천에 만족도를 남기고 클릭을 채울 수 있습니다. 추천이 비로그인도 받을 수
 * 있어 신원으로는 막을 수 없으므로, 추측할 수 없는 값으로 확인합니다.
 *
 * <p>추천을 만드는 {@link NaturalLanguageRecommendationController} 와 경로 앞부분을 공유하되
 * 컨트롤러를 나눴습니다. 추천은 AI 서버를 부르고 호출량 제한이 걸리는 무거운 경로이고, 여기는
 * 이미 남아 있는 줄을 고치는 가벼운 경로입니다.
 *
 * <p><b>이 기록이 없으면 사전을 무엇으로 넓힐지 정할 근거가 없습니다.</b> 실사용 설문 143건 중
 * 39.9% 가 향 조건을 하나도 못 뽑는 문장이었는데, 그것을 고치려면 사람들이 실제로 무엇을 눌렀고
 * 무엇에 만족했는지가 있어야 합니다.
 */
@Tag(name = "자연어 추천 피드백",
        description = "추천 결과의 클릭과 만족도를 남깁니다.")
@RestController
@RequestMapping("/api/v1/recommendations/natural-language/{recommendationToken}")
public class NlrFeedbackController {

    private final NlrFeedbackService feedbackService;
    private final RecommendationRateLimiter rateLimiter;

    public NlrFeedbackController(
            NlrFeedbackService feedbackService,
            RecommendationRateLimiter rateLimiter
    ) {
        this.feedbackService = feedbackService;
        this.rateLimiter = rateLimiter;
    }

    /**
     * 추천 결과에서 카드를 눌렀다고 남깁니다.
     *
     * <p>향수 번호가 아니라 <b>순위</b>를 보냅니다. 알고 싶은 것이 "몇 위를 눌렀나" 이고, 그
     * 값은 {@code user_perfume_views} 에 남지 않습니다.
     *
     * <p>같은 카드를 여러 번 눌러도 처음 시각만 남습니다. 두 번째부터는 아무것도 바뀌지 않고
     * 같은 204 가 나갑니다.
     */
    @Operation(summary = "추천 결과 클릭 기록",
            description = "누른 카드의 순위를 남깁니다. 여러 번 눌러도 처음 시각을 지킵니다.")
    @ApiResponse(responseCode = "204", description = "기록 성공")
    @ApiResponse(responseCode = "400", description = "rank 가 없거나 1~5 를 벗어났습니다.")
    @ApiResponse(responseCode = "404", description = "그 추천이나 그 순위의 결과가 없습니다.")
    @ApiResponse(responseCode = "429", description = "호출량 제한을 넘었습니다.")
    @PostMapping("/clicks")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordClick(
            @Parameter(description = "추천 응답의 recommendationToken")
            @PathVariable UUID recommendationToken,
            @Valid @RequestBody NlrClickRequest request,
            HttpServletRequest httpRequest
    ) {
        rateLimiter.checkFeedback(httpRequest.getRemoteAddr());
        feedbackService.recordClick(recommendationToken, request.rank());
    }

    /**
     * 추천이 마음에 들었는지 남깁니다.
     *
     * <p>한 추천에 한 번입니다. 다시 보내면 409 입니다 — 화면을 다시 열어 같은 버튼이 눌리는
     * 일이 있어 처음 답을 지킵니다.
     */
    @Operation(summary = "추천 만족도 기록",
            description = "만족 · 보통 · 불만족 중 하나를 남깁니다. 한 추천에 한 번입니다.")
    @ApiResponse(responseCode = "201", description = "기록 성공")
    @ApiResponse(responseCode = "400",
            description = "satisfaction 이 없거나 세 값 밖이거나, comment 가 500자를 넘었습니다.")
    @ApiResponse(responseCode = "404", description = "그 번호의 추천이 없습니다.")
    @ApiResponse(responseCode = "409", description = "이미 만족도를 남긴 추천입니다.")
    @ApiResponse(responseCode = "429", description = "호출량 제한을 넘었습니다.")
    @PostMapping("/feedback")
    @ResponseStatus(HttpStatus.CREATED)
    public void recordFeedback(
            @Parameter(description = "추천 응답의 recommendationToken")
            @PathVariable UUID recommendationToken,
            @Valid @RequestBody NlrFeedbackRequest request,
            HttpServletRequest httpRequest
    ) {
        rateLimiter.checkFeedback(httpRequest.getRemoteAddr());
        feedbackService.recordFeedback(recommendationToken, request);
    }
}
