package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.recommendation.dto.request.NlrFeedbackRequest;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.NlrRecordRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 추천을 받은 뒤의 행동을 받습니다 — 어느 카드를 눌렀는지와 마음에 들었는지.
 *
 * <p>추천을 만드는 {@link NaturalLanguageRecommendationService} 와 나눈 이유는 시점이 다르기
 * 때문입니다. 추천은 AI 서버를 부르는 무거운 경로이고, 여기는 이미 남아 있는 줄을 한 칸
 * 고치는 일입니다.
 *
 * <h2>신원 대신 손잡이로 확인합니다</h2>
 *
 * <p>추천은 <b>비로그인도 받을 수 있습니다.</b> 그래서 "이 요청이 그 추천의 주인이 보낸 것인가"
 * 를 신원으로 확인할 수 없습니다. 로그인을 요구하면 확인은 되지만 비회원의 행동을 하나도 못
 * 모으는데, 이 표의 존재 이유가 실사용 행동을 모으는 것이라 앞뒤가 맞지 않습니다.
 *
 * <p>대신 <b>추측할 수 없는 손잡이</b>({@code public_token})로 확인합니다. 그 값은 자기 추천
 * 응답에서만 나오므로, 가지고 있다는 것이 곧 그 추천을 받았다는 뜻입니다. 익명은 그대로
 * 두면서 위조만 막습니다 — 초대 링크나 비밀번호 재설정 링크와 같은 구조입니다.
 *
 * <p><b>내부 번호를 밖으로 내보내면 안 됩니다.</b> {@code recommendation_id} 는 1부터 차례로
 * 붙어, 그것을 받는 API 는 1부터 세기만 해도 남의 추천을 전부 건드릴 수 있습니다. 그러면 만족도
 * 지표와 클릭 순위가 통째로 오염되고, 오염된 줄과 진짜 줄을 나중에 구분할 방법이 없습니다.
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
     * <p>없는 손잡이나 없는 순위는 404 입니다. 둘을 한 코드로 묶어 "손잡이는 맞는데 그 순위가
     * 없다" 를 알려 주지 않습니다.
     */
    @Transactional
    public void recordClick(UUID recommendationToken, int rank) {
        long recommendationId = resolve(recommendationToken);

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
    public void recordFeedback(UUID recommendationToken, NlrFeedbackRequest request) {
        long recommendationId = resolve(recommendationToken);

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

    /**
     * 손잡이를 내부 번호로 바꿉니다. 없으면 404 입니다.
     *
     * <p>보관 기간이 지나 원문이 비워진 추천도 여기서 찾힙니다. 비우는 것은 원문뿐이고 행은
     * 남기 때문입니다.
     */
    private long resolve(UUID recommendationToken) {
        return repository.findIdByToken(recommendationToken)
                .orElseThrow(() -> new BusinessException(
                        RecommendationErrorCode.RECOMMENDATION_RECORD_NOT_FOUND));
    }
}
