package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.recommendation.dto.request.NlrFeedbackRequest;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.NlrRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 추천을 받은 뒤의 행동을 받습니다 — 어느 카드를 눌렀는지와 마음에 들었는지.
 *
 * <p>추천을 만드는 {@link NaturalLanguageRecommendationService} 와 나눈 이유는 시점이 다르기
 * 때문입니다. 추천은 AI 서버를 부르는 무거운 경로이고, 여기는 이미 남아 있는 줄을 한 칸
 * 고치는 일입니다. 같은 서비스에 두면 AI 클라이언트가 필요 없는 요청에도 딸려옵니다.
 *
 * <p><b>누가 보냈는지 확인하지 않습니다.</b> 추천 자체가 비로그인도 받을 수 있어 요청자를
 * 확인할 방법이 없습니다. 추천 번호를 아는 사람만 보낼 수 있고, 그 번호는 자기 추천 응답에서만
 * 나옵니다. 남의 번호를 찍어 맞히면 그 추천의 집계가 흐려지는데, 그것을 막으려면 로그인을
 * 요구해야 하고 그러면 비로그인 사용자의 행동을 못 모읍니다. 지금은 모으는 쪽을 택했습니다.
 */
@Service
public class NlrFeedbackService {

    private final NlrRecordRepository repository;

    public NlrFeedbackService(NlrRecordRepository repository) {
        this.repository = repository;
    }

    /**
     * 그 순위의 카드를 눌렀다고 남깁니다.
     *
     * <p><b>여러 번 눌러도 처음 시각을 지킵니다.</b> 덮어쓰면 "추천을 받고 얼마 만에 눌렀나" 가
     * 마지막 클릭 기준으로 바뀝니다.
     *
     * <p>없는 추천이나 없는 순위는 404 입니다. 조용히 넘기면 화면이 잘못된 번호를 계속 보내도
     * 아무도 모릅니다.
     */
    @Transactional
    public void recordClick(long recommendationId, int rank) {
        repository.findItemPerfumeId(recommendationId, rank)
                .orElseThrow(() -> new BusinessException(
                        RecommendationErrorCode.RECOMMENDATION_RECORD_NOT_FOUND));

        repository.markClicked(recommendationId, rank);
    }

    /**
     * 만족도를 남깁니다.
     *
     * <p>이미 답한 추천이면 409 입니다. 표의 기본키가 막아 주지만 그대로 두면 500 이 나가므로
     * 먼저 확인합니다. <b>확인과 삽입 사이에 다른 요청이 끼어들 수 있습니다</b> — 그때는 DB 가
     * 막아 500 이 나갑니다. 사람이 버튼을 두 번 누르는 간격에서 실제로 겹치기는 어렵고, 막으려면
     * 잠금이 필요한데 이 표의 값어치에 비해 무겁습니다.
     */
    @Transactional
    public void recordFeedback(long recommendationId, NlrFeedbackRequest request) {
        if (!repository.existsRecommendation(recommendationId)) {
            throw new BusinessException(
                    RecommendationErrorCode.RECOMMENDATION_RECORD_NOT_FOUND);
        }
        if (repository.existsFeedback(recommendationId)) {
            throw new BusinessException(
                    RecommendationErrorCode.RECOMMENDATION_FEEDBACK_ALREADY_ANSWERED);
        }
        repository.insertFeedback(
                recommendationId,
                request.satisfaction().name(),
                request.comment()
        );
    }
}
