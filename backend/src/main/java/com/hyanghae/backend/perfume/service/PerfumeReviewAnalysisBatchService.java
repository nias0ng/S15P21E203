package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.batch.ReviewAnalysisProperties;
import com.hyanghae.backend.perfume.repository.KeywordCount;
import com.hyanghae.backend.perfume.repository.PerfumeReviewKeywordRepository;
import com.hyanghae.backend.perfume.repository.PerfumeReviewRepository;
import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.repository.ReviewSummaryTarget;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.AnalysisSource;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ReviewAnalysis;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ReviewKeywords;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
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

    /**
     * 모델에게 알려 줄 "이미 쓰인 표기" 개수입니다.
     *
     * <p>많이 나온 순으로 앞에서 이만큼만 봅니다. 전부 넘기면 지시문이 길어지고, 한 번만 나온
     * 표현까지 "이 중에서 쓰라" 고 말하게 되어 새 후기의 표현이 엉뚱한 이름으로 묶입니다.
     */
    private static final int KNOWN_KEYWORD_HINT_SIZE = 20;

    /** 키워드 이름 안의 연속된 공백을 하나로 줄이는 패턴입니다. */
    private static final String WHITESPACE_RUN = "\\s+";

    private final PerfumeReviewRepository perfumeReviewRepository;
    private final PerfumeReviewKeywordRepository perfumeReviewKeywordRepository;
    private final ReviewAnalyzer reviewAnalyzer;
    private final PerfumeReviewAnalysisWriter perfumeReviewAnalysisWriter;
    private final ReviewAnalysisProperties properties;

    public PerfumeReviewAnalysisBatchService(
            PerfumeReviewRepository perfumeReviewRepository,
            PerfumeReviewKeywordRepository perfumeReviewKeywordRepository,
            ReviewAnalyzer reviewAnalyzer,
            PerfumeReviewAnalysisWriter perfumeReviewAnalysisWriter,
            ReviewAnalysisProperties properties
    ) {
        this.perfumeReviewRepository = perfumeReviewRepository;
        this.perfumeReviewKeywordRepository = perfumeReviewKeywordRepository;
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
     *
     * <p>요약과 키워드의 대상이 다릅니다. 요약은 향수 하나에 대한 글이라 최근 후기 전체를 근거로
     * 하지만, 키워드는 아직 뽑지 않은 후기에서만 뽑습니다. 이미 뽑아 둔 후기를 다시 뽑으면 출력이
     * 그만큼 길어져 호출 시간과 비용만 늘고 결과는 대체로 같습니다.
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

        Set<Long> keywordTargetIds = findReviewsWithoutKeywords(reviews);
        ReviewAnalysis analysis = reviewAnalyzer.analyze(new AnalysisSource(
                reviews,
                keywordTargetIds,
                findKnownKeywords(target.perfumeId())
        ));

        String summary = normalizeSummary(target.perfumeId(), analysis.summary());
        if (summary == null) {
            log.warn("Review analysis skipped, empty summary: perfumeId={}", target.perfumeId());
            return false;
        }

        log.debug(
                "Review analysis loaded: perfumeId={}, reviews={}, keywordTargets={}",
                target.perfumeId(),
                reviews.size(),
                keywordTargetIds.size()
        );
        perfumeReviewAnalysisWriter.write(new PerfumeReviewAnalysis(
                target.perfumeId(),
                sourceReviewCount(target),
                summary,
                List.copyOf(keywordTargetIds),
                normalizeKeywords(target.perfumeId(), analysis, keywordTargetIds)
        ));
        return true;
    }

    /**
     * 보낼 후기 중 키워드가 아직 없는 것만 골라냅니다.
     *
     * <p>이미 키워드가 붙은 후기는 그 값을 그대로 둡니다. 다시 뽑아도 대체로 같은 값이 나오는데,
     * 출력이 후기 수에 비례해 길어져 호출 시간이 늘어납니다. 후기 16건을 모두 뽑을 때 한 번의
     * 호출이 55초까지 걸렸습니다.
     */
    private Set<Long> findReviewsWithoutKeywords(List<ReviewContent> reviews) {
        Set<Long> reviewIds = reviews.stream()
                .map(ReviewContent::reviewId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        reviewIds.removeAll(
                Set.copyOf(perfumeReviewKeywordRepository.findAnalyzedReviewIds(reviewIds)));
        return reviewIds;
    }

    /**
     * 이 향수의 후기에서 이미 쓰인 키워드 이름입니다. 많이 나온 순으로 몇 개만 봅니다.
     *
     * <p>모델에게 같은 뜻은 같은 표기로 쓰라고 알려 주는 데 씁니다. 이번 호출은 새 후기만 보므로,
     * 알려 주지 않으면 같은 표현에 지난번과 다른 이름이 붙습니다("파우더" 와 "파우더리"). 그러면
     * 같은 뜻이 두 키워드로 갈라져 상위 몇 개를 뽑을 때 순위가 왜곡됩니다.
     */
    private List<String> findKnownKeywords(Long perfumeId) {
        return perfumeReviewKeywordRepository
                .findKeywordCountsByPerfumeId(perfumeId, PageRequest.ofSize(KNOWN_KEYWORD_HINT_SIZE))
                .stream()
                .map(KeywordCount::keyword)
                .toList();
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
     * <p>모델의 출력이므로 그대로 믿지 않습니다. 대상이 아닌 후기 번호, 빈 문자열, 어휘 컬럼보다
     * 긴 이름, 같은 후기에 같은 키워드가 두 번 오는 경우가 모두 실제로 나옵니다.
     *
     * <p>키워드 대상이 아닌 후기 번호는 버립니다. 두 가지를 함께 막습니다. 하나는 모델이 만들어낸
     * 번호입니다. 다른 향수의 후기 번호일 수 있어 그대로 적재하면 엉뚱한 향수의 통계가 바뀝니다.
     * 다른 하나는 이미 키워드가 있는 후기입니다. 요약의 근거로 보냈을 뿐이라 모델이 지시를
     * 무시하고 그 후기의 키워드를 돌려줘도 적재하지 않습니다. 판단을 모델에게 맡기지 않습니다.
     *
     * <p>같은 후기 번호가 두 번 오면 앞의 것만 씁니다. 합치면 후기 하나의 키워드 수 제한이
     * 무너집니다.
     */
    private Map<Long, List<String>> normalizeKeywords(
            Long perfumeId,
            ReviewAnalysis analysis,
            Set<Long> keywordTargetIds
    ) {
        Map<Long, List<String>> keywordsByReviewId = new LinkedHashMap<>();

        for (ReviewKeywords extracted : analysis.reviewKeywords()) {
            Long reviewId = extracted.reviewId();
            if (reviewId == null || !keywordTargetIds.contains(reviewId)) {
                log.warn(
                        "Review analysis returned review outside targets: perfumeId={}, reviewId={}",
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
