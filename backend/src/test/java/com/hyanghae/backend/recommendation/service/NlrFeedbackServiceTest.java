package com.hyanghae.backend.recommendation.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.mock;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.recommendation.dto.request.NlrFeedbackRequest;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.NlrRecordRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;

/**
 * 만족도 경합에서 기본키 위반을 409 로 바꾸는지 봅니다.
 *
 * <p><b>동시성 통합 테스트로는 이것을 보장할 수 없습니다.</b> 두 요청이 실제로 겹쳤는지는
 * 그때그때 다르고, 겹치지 않으면 앞의 {@code existsFeedback} 확인에서 걸려 같은 409 가
 * 나갑니다. 그래서 통합 테스트는 통과해도 {@code catch} 가 도는지는 알 수 없습니다.
 *
 * <p>여기서는 대역으로 <b>그 순간만</b> 만듭니다 — 확인은 통과했는데 삽입에서 막히는 상태.
 * 실제로 경합이 일어났을 때 사용자가 500 대신 409 를 받는지는 이 테스트가 답합니다.
 */
class NlrFeedbackServiceTest {

    private static final UUID TOKEN = UUID.randomUUID();
    private static final long RECOMMENDATION_ID = 42L;

    private final NlrRecordRepository repository = mock(NlrRecordRepository.class);
    private final NlrFeedbackService service = new NlrFeedbackService(repository);

    /**
     * 확인을 통과했는데 삽입이 막히면 409 입니다.
     *
     * <p>이 변환이 없으면 {@link DuplicateKeyException} 이 그대로 올라가 500 이 나갑니다.
     * 실제로 일어난 일은 "이미 답했다" 이지 서버 오류가 아닙니다.
     */
    @Test
    void turnsDuplicateKeyIntoConflict() {
        given(repository.findIdByToken(TOKEN)).willReturn(Optional.of(RECOMMENDATION_ID));
        given(repository.existsFeedback(RECOMMENDATION_ID)).willReturn(false);
        willThrow(new DuplicateKeyException("nlr_feedbacks_pkey"))
                .given(repository).insertFeedback(anyLong(), anyString(), anyString());

        assertThatThrownBy(() -> service.recordFeedback(TOKEN, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).errorCode())
                .isEqualTo(RecommendationErrorCode.RECOMMENDATION_FEEDBACK_ALREADY_ANSWERED);
    }

    /** 먼저 확인에서 걸리는 흔한 경로도 같은 코드로 나갑니다. */
    @Test
    void returnsSameConflictWhenAlreadyChecked() {
        given(repository.findIdByToken(TOKEN)).willReturn(Optional.of(RECOMMENDATION_ID));
        given(repository.existsFeedback(RECOMMENDATION_ID)).willReturn(true);

        assertThatThrownBy(() -> service.recordFeedback(TOKEN, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).errorCode())
                .isEqualTo(RecommendationErrorCode.RECOMMENDATION_FEEDBACK_ALREADY_ANSWERED);
    }

    /** 없는 손잡이는 404 입니다. 삽입까지 가지 않습니다. */
    @Test
    void rejectsUnknownToken() {
        given(repository.findIdByToken(TOKEN)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.recordFeedback(TOKEN, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).errorCode())
                .isEqualTo(RecommendationErrorCode.RECOMMENDATION_RECORD_NOT_FOUND);
    }

    /** 다른 오류는 삼키지 않습니다. 중복만 409 로 바꿉니다. */
    @Test
    void doesNotSwallowOtherFailures() {
        given(repository.findIdByToken(TOKEN)).willReturn(Optional.of(RECOMMENDATION_ID));
        given(repository.existsFeedback(RECOMMENDATION_ID)).willReturn(false);
        willThrow(new IllegalStateException("커넥션이 끊겼습니다"))
                .given(repository).insertFeedback(anyLong(), anyString(), anyString());

        assertThatThrownBy(() -> service.recordFeedback(TOKEN, request()))
                .isInstanceOf(IllegalStateException.class);
    }

    private NlrFeedbackRequest request() {
        return new NlrFeedbackRequest(NlrFeedbackRequest.Satisfaction.SATISFIED, "한마디");
    }
}
