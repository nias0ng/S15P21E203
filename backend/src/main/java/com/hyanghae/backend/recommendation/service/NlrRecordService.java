package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.recommendation.client.NlrRecommendResponse;
import com.hyanghae.backend.recommendation.repository.NlrRecordRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 자연어 추천 한 건을 {@code nlr_*} 표에 남깁니다.
 *
 * <p>추천 서비스에서 떼어 둔 이유가 둘입니다.
 *
 * <p>첫째, <b>한 트랜잭션이어야 합니다.</b> 요청 줄이 먼저 들어가야 번호가 나오고 나머지 두 표가
 * 그 번호를 가리킵니다. 중간에 실패하면 결과 없는 요청 줄만 남는데, 그것을 나중에 보면 "추천이
 * 0개였다" 와 구분되지 않습니다.
 *
 * <p>둘째, 추천 서비스가 자기 메서드를 직접 부르면 {@code @Transactional} 이 걸리지 않습니다.
 * Spring 의 프록시를 거치지 않기 때문입니다.
 *
 * <p><b>여기서 나는 오류는 추천을 막지 않습니다.</b> 부르는 쪽이 잡아서 로그만 남깁니다 —
 * 기록이 안 됐다고 사용자가 추천을 못 받을 이유는 없습니다.
 */
@Service
public class NlrRecordService {

    /** 조건을 하나로 잇는 구분자입니다. 요청서가 파이프로 정했습니다. */
    private static final String ACCORD_DELIMITER = "|";

    /** {@code core_accords} 칸의 길이입니다. 넘치면 잘라 넣습니다. */
    private static final int CORE_ACCORDS_LIMIT = 500;

    /** {@code avoid_accords} 칸의 길이입니다. */
    private static final int AVOID_ACCORDS_LIMIT = 200;

    private final NlrRecordRepository repository;

    public NlrRecordService(NlrRecordRepository repository) {
        this.repository = repository;
    }

    /**
     * 요청 · 결과 · 미매칭을 한 트랜잭션으로 남기고 요청 번호를 돌려줍니다.
     *
     * <p>화면이 이 번호로 클릭과 만족도를 보냅니다.
     *
     * @param userId     비로그인이면 {@code null} 입니다.
     * @param status     화면에 나가는 것과 같은 값을 남깁니다. AI 가 준 값이 아니라 우리가
     *                   정리한 값이어야 기록과 화면이 어긋나지 않습니다.
     * @param perfumeIds 우리 DB 의 향수 번호입니다. <b>순서가 곧 순위입니다.</b>
     */
    @Transactional
    public long record(
            Long userId,
            String query,
            String status,
            NlrRecommendResponse ai,
            List<Long> perfumeIds
    ) {
        NlrRecommendResponse.Conditions conditions = ai.conditions();
        NlrRecommendResponse.Diagnostics diagnostics = ai.diagnostics();

        long recommendationId = repository.insertRecommendation(
                userId,
                query,
                status,
                diagnostics == null ? null : diagnostics.stage(),
                conditions == null ? null : conditions.source(),
                join(conditions == null ? null : conditions.core(), CORE_ACCORDS_LIMIT),
                join(conditions == null ? null : conditions.avoid(), AVOID_ACCORDS_LIMIT),
                diagnostics == null ? null : diagnostics.candidateCount()
        );

        repository.insertItems(recommendationId, perfumeIds);
        if (ai.unmatched() != null && !ai.unmatched().isEmpty()) {
            repository.insertUnmatched(recommendationId, ai.unmatched());
        }
        return recommendationId;
    }

    /**
     * 조건을 파이프로 잇습니다. 비어 있으면 {@code null} 입니다 — 빈 문자열로 넣으면 "조건이
     * 없었다" 와 "조건 칸이 빈 문자열이다" 를 나중에 구분할 수 없습니다.
     *
     * <p>칸 길이를 넘으면 자릅니다. 조건이 아주 많은 요청 하나 때문에 기록 전체가 실패하는 것이
     * 더 나쁩니다. 자른 값도 "어떤 조건이었나" 를 대략 보여줍니다.
     */
    private String join(List<String> accords, int limit) {
        if (accords == null || accords.isEmpty()) {
            return null;
        }
        String joined = String.join(ACCORD_DELIMITER, accords);
        return joined.length() <= limit ? joined : joined.substring(0, limit);
    }
}
