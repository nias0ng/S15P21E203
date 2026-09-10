package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.batch.ReviewAnalysisProperties;
import com.hyanghae.backend.perfume.repository.PerfumeReviewRepository;
import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.repository.ReviewSummaryTarget;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ReviewAnalysis;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ReviewKeywords;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * 후기가 쌓인 향수의 요약과 키워드를 AI 로 만들어 적재합니다.
 *
 * <p>대상 선정은 두 가지 정책입니다. 후기가 최소 개수를 넘겼는지, 그리고 지난 요약 이후 후기가
 * 정책 개수만큼 늘었는지입니다. 두 값은 설정으로 바꿉니다.
 *
 * <p>트랜잭션을 걸지 않았습니다. AI 호출이 수십 초 걸릴 수 있어 그 시간 동안 커넥션을 잡고
 * 있으면 안 됩니다. 조회는 각 리포지토리 호출이 자기 트랜잭션에서 끝나고, 적재는
 * {@link PerfumeReviewAnalysisWriter} 가 한 트랜잭션으로 처리합니다.
 *
 * <p>향수 하나가 실패해도 다음 향수로 넘어갑니다. AI 호출은 시간 초과나 사용량 제한으로 언제든
 * 실패할 수 있는데, 한 건 때문에 나머지를 포기하면 실패가 실행 전체로 번집니다. 적재하지 못한
 * 향수는 {@code source_review_count} 가 그대로여서 다음 실행에 다시 대상이 됩니다.
 *
 * <p>인스턴스가 하나라는 전제로 만들었습니다. 지금 배포는 컨테이너 한 개입니다. 여러 대로 늘리면
 * 같은 향수를 동시에 분석해 호출이 두 번 나갈 수 있으므로, 그때 실행 잠금을 추가해야 합니다.
 */
@Service
public class PerfumeReviewAnalysisBatchService {

    private static final Logger log =
            LoggerFactory.getLogger(PerfumeReviewAnalysisBatchService.class);

    /** 키워드 이름 안의 연속된 공백을 하나로 줄이는 패턴입니다. */
    private static final String WHITESPACE_RUN = "\\s+";

    private final PerfumeReviewRepository perfumeReviewRepository;
    private final ReviewAnalyzer reviewAnalyzer;
    private final PerfumeReviewAnalysisWriter perfumeReviewAnalysisWriter;
    private final ReviewAnalysisProperties properties;

    public PerfumeReviewAnalysisBatchService(
            PerfumeReviewRepository perfumeReviewRepository,
            ReviewAnalyzer reviewAnalyzer,
            PerfumeReviewAnalysisWriter perfumeReviewAnalysisWriter,
            ReviewAnalysisProperties properties
    ) {
        this.perfumeReviewRepository = perfumeReviewRepository;
        this.reviewAnalyzer = reviewAnalyzer;
        this.perfumeReviewAnalysisWriter = perfumeReviewAnalysisWriter;
        this.properties = properties;
    }

    /**
     * 정책 조건을 넘긴 향수를 찾아 차례로 분석하고 적재합니다.
     *
     * <p>한 번에 처리할 향수 수를 제한합니다. 후기가 한꺼번에 쌓이면 한 실행에서 수백 번의 AI
     * 호출이 나갈 수 있습니다. 남은 향수는 다음 실행이 이어서 집어 듭니다.
     */
    public ReviewAnalysisBatchResult analyzePerfumesNeedingSummary() {
        long startedAt = System.nanoTime();

        List<ReviewSummaryTarget> targets = perfumeReviewRepository.findSummaryTargets(
                properties.minReviewCount(),
                properties.regenerationStep(),
                PageRequest.ofSize(properties.maxPerfumesPerRun())
        );

        int analyzed = 0;
        int skipped = 0;
        int failed = 0;
        for (ReviewSummaryTarget target : targets) {
            try {
                if (analyze(target)) {
                    analyzed++;
                } else {
                    skipped++;
                }
            } catch (RuntimeException exception) {
                failed++;
                log.error(
                        "Review analysis failed: perfumeId={}, exceptionType={}",
                        target.perfumeId(),
                        exception.getClass().getName(),
                        exception
                );
            }
        }

        log.info(
                "Review analysis batch completed: targets={}, analyzed={}, skipped={}, failed={},"
                        + " durationMs={}",
                targets.size(),
                analyzed,
                skipped,
                failed,
                (System.nanoTime() - startedAt) / 1_000_000
        );
        return new ReviewAnalysisBatchResult(targets.size(), analyzed, skipped, failed);
    }

    /**
     * 향수 하나를 분석해 적재합니다. 적재했으면 {@code true} 입니다.
     *
     * <p>후기 본문과 요약 어느 쪽이든 비어 있으면 적재하지 않습니다. 빈 요약을 저장하면
     * {@code source_review_count} 가 올라가 다음 실행에서 재시도되지 않는데, 화면에는 아무것도
     * 나오지 않습니다.
     */
    private boolean analyze(ReviewSummaryTarget target) {
        List<ReviewContent> reviews = perfumeReviewRepository.findContentsByPerfumeId(
                target.perfumeId(),
                PageRequest.ofSize(properties.maxReviewsPerRequest())
        );
        if (reviews.isEmpty()) {
            log.info(
                    "Review analysis skipped, no review text: perfumeId={}, reviewCount={}",
                    target.perfumeId(),
                    target.reviewCount()
            );
            return false;
        }

        ReviewAnalysis analysis = reviewAnalyzer.analyze(reviews);

        String summary = normalizeSummary(target.perfumeId(), analysis.summary());
        if (summary == null) {
            log.warn("Review analysis skipped, empty summary: perfumeId={}", target.perfumeId());
            return false;
        }

        List<Long> analyzedReviewIds = reviews.stream().map(ReviewContent::reviewId).toList();
        perfumeReviewAnalysisWriter.write(new PerfumeReviewAnalysis(
                target.perfumeId(),
                sourceReviewCount(target),
                summary,
                analyzedReviewIds,
                normalizeKeywords(target.perfumeId(), analysis, Set.copyOf(analyzedReviewIds))
        ));
        return true;
    }

    /**
     * {@code source_review_count} 는 향수에 달린 전체 후기 수입니다. AI 에게 보낸 후기 수가
     * 아닙니다.
     *
     * <p>이 값은 후기 통계 API 의 {@code reviewCount} 와 비교해 요약이 최신인지 판단하는 데
     * 쓰입니다. 보낸 후기 수를 넣으면 후기가 개수 제한을 넘긴 향수는 두 값이 영구히 달라
     * 매 실행마다 재생성 대상이 됩니다.
     */
    private int sourceReviewCount(ReviewSummaryTarget target) {
        return Math.toIntExact(target.reviewCount());
    }

    /** 앞뒤 공백을 지우고, 너무 긴 요약은 자릅니다. 비어 있으면 {@code null} 입니다. */
    private String normalizeSummary(Long perfumeId, String summary) {
        if (summary == null || summary.isBlank()) {
            return null;
        }

        String trimmed = summary.trim();
        if (trimmed.length() <= properties.maxSummaryLength()) {
            return trimmed;
        }

        log.warn(
                "Review summary truncated: perfumeId={}, length={}, limit={}",
                perfumeId,
                trimmed.length(),
                properties.maxSummaryLength()
        );
        return trimmed.substring(0, properties.maxSummaryLength());
    }

    /**
     * 키워드를 적재할 수 있는 형태로 다듬습니다.
     *
     * <p>모델의 출력이므로 그대로 믿지 않습니다. 보내지 않은 후기 번호, 빈 문자열, 어휘 컬럼보다
     * 긴 이름, 같은 후기에 같은 키워드가 두 번 오는 경우가 모두 실제로 나옵니다.
     *
     * <p>보내지 않은 후기 번호는 버립니다. 다른 향수의 후기 번호일 수 있어, 그대로 적재하면
     * 엉뚱한 향수의 키워드 통계가 바뀝니다.
     *
     * <p>같은 후기 번호가 두 번 오면 앞의 것만 씁니다. 합치면 후기 하나의 키워드 수 제한이
     * 무너집니다.
     */
    private Map<Long, List<String>> normalizeKeywords(
            Long perfumeId,
            ReviewAnalysis analysis,
            Set<Long> analyzedReviewIds
    ) {
        Map<Long, List<String>> keywordsByReviewId = new LinkedHashMap<>();

        for (ReviewKeywords extracted : analysis.reviewKeywords()) {
            Long reviewId = extracted.reviewId();
            if (reviewId == null || !analyzedReviewIds.contains(reviewId)) {
                log.warn(
                        "Review analysis returned unknown review: perfumeId={}, reviewId={}",
                        perfumeId,
                        reviewId
                );
                continue;
            }

            List<String> names = extracted.keywords().stream()
                    .map(this::normalizeKeyword)
                    .filter(Objects::nonNull)
                    .distinct()
                    .limit(properties.maxKeywordsPerReview())
                    .toList();
            if (!names.isEmpty()) {
                keywordsByReviewId.putIfAbsent(reviewId, names);
            }
        }

        return keywordsByReviewId;
    }

    /**
     * 키워드 이름 하나를 다듬습니다. 쓸 수 없으면 {@code null} 입니다.
     *
     * <p>어휘 컬럼보다 긴 이름은 자르지 않고 버립니다. 자르면 중간에서 끊긴 이름이 어휘에 남고,
     * 그 이름이 통계 화면에 그대로 나옵니다.
     */
    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }

        String normalized = keyword.trim().replaceAll(WHITESPACE_RUN, " ");
        if (normalized.length() > properties.maxKeywordLength()) {
            log.debug(
                    "Review keyword dropped, too long: length={}, limit={}",
                    normalized.length(),
                    properties.maxKeywordLength()
            );
            return null;
        }

        return normalized;
    }
}
