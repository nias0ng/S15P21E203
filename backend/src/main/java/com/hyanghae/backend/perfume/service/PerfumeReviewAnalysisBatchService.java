package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.batch.ReviewAnalysisProperties;
import com.hyanghae.backend.perfume.repository.KeywordCount;
import com.hyanghae.backend.perfume.repository.KeywordExtractionTarget;
import com.hyanghae.backend.perfume.repository.PerfumeReviewKeywordRepository;
import com.hyanghae.backend.perfume.repository.PerfumeReviewRepository;
import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ExtractedKeywords;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ExtractionSource;
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
 * 후기에서 향 표현 키워드를 AI 로 뽑아 적재합니다.
 *
 * <p>요약 문장은 만들지 않습니다. 화면이 상위 키워드 몇 개와 그 비중으로 문장을 구성하기로
 * 정해졌습니다. 그래서 이 배치의 산출물은 {@code perfume_review_keywords} 뿐이고,
 * {@code perfume_review_summaries} 는 아무도 채우지 않습니다.
 *
 * <p>후기 하나는 한 번만 분석합니다. 이미 뽑은 후기를 다시 뽑아도 대체로 같은 값이 나오는데
 * 출력이 후기 수에 비례해 길어져 호출 시간과 비용만 늘어납니다. 어디까지 했는지는
 * {@code perfume_reviews.keywords_extracted_at} 이 기록합니다.
 *
 * <p>트랜잭션을 걸지 않았습니다. AI 호출이 수십 초 걸릴 수 있어 그 시간 동안 커넥션을 잡고
 * 있으면 안 됩니다. 조회는 각 리포지토리 호출이 자기 트랜잭션에서 끝나고, 적재는
 * {@link PerfumeReviewKeywordWriter} 가 한 트랜잭션으로 처리합니다.
 *
 * <p>향수 하나가 실패해도 다음 향수로 넘어갑니다. AI 호출은 시간 초과나 사용량 제한으로 언제든
 * 실패할 수 있는데, 한 건 때문에 나머지를 포기하면 실패가 실행 전체로 번집니다. 적재하지 못한
 * 후기는 추출 시각이 비어 있어 다음 실행에 다시 대상이 됩니다.
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
    private final PerfumeReviewKeywordWriter perfumeReviewKeywordWriter;
    private final ReviewAnalysisProperties properties;

    public PerfumeReviewAnalysisBatchService(
            PerfumeReviewRepository perfumeReviewRepository,
            PerfumeReviewKeywordRepository perfumeReviewKeywordRepository,
            ReviewAnalyzer reviewAnalyzer,
            PerfumeReviewKeywordWriter perfumeReviewKeywordWriter,
            ReviewAnalysisProperties properties
    ) {
        this.perfumeReviewRepository = perfumeReviewRepository;
        this.perfumeReviewKeywordRepository = perfumeReviewKeywordRepository;
        this.reviewAnalyzer = reviewAnalyzer;
        this.perfumeReviewKeywordWriter = perfumeReviewKeywordWriter;
        this.properties = properties;
    }

    /**
     * 키워드를 뽑아야 하는 후기가 남은 향수를 찾아 차례로 처리합니다.
     *
     * <p>한 번에 처리할 향수 수를 제한합니다. 후기가 한꺼번에 쌓이면 한 실행에서 수백 번의 AI
     * 호출이 나갈 수 있습니다. 남은 향수는 다음 실행이 이어서 집어 듭니다. 한 향수에서 보내는
     * 후기 수도 제한이 있어, 후기가 많이 밀린 향수는 여러 실행에 걸쳐 처리됩니다.
     */
    public ReviewAnalysisBatchResult extractPendingKeywords() {
        long startedAt = System.nanoTime();

        List<KeywordExtractionTarget> targets =
                perfumeReviewRepository.findKeywordExtractionTargets(
                        properties.minReviewCount(),
                        PageRequest.ofSize(properties.maxPerfumesPerRun())
                );

        int analyzed = 0;
        int skipped = 0;
        int failed = 0;
        for (KeywordExtractionTarget target : targets) {
            try {
                if (extract(target)) {
                    analyzed++;
                } else {
                    skipped++;
                }
            } catch (RuntimeException exception) {
                failed++;
                log.error(
                        "Review keyword extraction failed: perfumeId={}, exceptionType={}",
                        target.perfumeId(),
                        exception.getClass().getName(),
                        exception
                );
            }
        }

        log.info(
                "Review keyword batch completed: targets={}, analyzed={}, skipped={}, failed={},"
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
     * 향수 하나의 밀린 후기에서 키워드를 뽑아 적재합니다. 적재했으면 {@code true} 입니다.
     *
     * <p>보낼 후기가 없으면 건너뜁니다. 대상 선정과 이 조회 사이에 다른 실행이 처리했거나 후기가
     * 지워진 경우입니다.
     */
    private boolean extract(KeywordExtractionTarget target) {
        List<ReviewContent> reviews = perfumeReviewRepository.findContentsWithoutKeywords(
                target.perfumeId(),
                PageRequest.ofSize(properties.maxReviewsPerRequest())
        );
        if (reviews.isEmpty()) {
            log.info(
                    "Review keyword extraction skipped, nothing pending: perfumeId={}",
                    target.perfumeId()
            );
            return false;
        }

        ExtractedKeywords extracted = reviewAnalyzer.extract(new ExtractionSource(
                reviews,
                findKnownKeywords(target.perfumeId())
        ));

        List<Long> extractedReviewIds = reviews.stream().map(ReviewContent::reviewId).toList();
        Map<Long, List<String>> keywords = normalizeKeywords(
                target.perfumeId(), extracted, Set.copyOf(extractedReviewIds));

        log.debug(
                "Review keyword extraction loaded: perfumeId={}, sent={}, pending={}, withKeywords={}",
                target.perfumeId(),
                reviews.size(),
                target.pendingCount(),
                keywords.size()
        );
        perfumeReviewKeywordWriter.write(new PerfumeReviewKeywords(
                target.perfumeId(),
                extractedReviewIds,
                keywords
        ));
        return true;
    }

    /**
     * 이 향수의 후기에서 이미 쓰인 키워드 이름입니다. 많이 나온 순으로 몇 개만 봅니다.
     *
     * <p>모델에게 같은 뜻은 같은 표기로 쓰라고 알려 주는 데 씁니다. 후기 하나는 한 번만 분석하므로
     * 이번 호출은 새 후기만 봅니다. 알려 주지 않으면 같은 표현에 지난번과 다른 이름이 붙습니다
     * ("파우더" 와 "파우더리"). 그러면 같은 뜻이 두 키워드로 갈라져 상위 몇 개를 뽑을 때 순위가
     * 왜곡됩니다.
     */
    private List<String> findKnownKeywords(Long perfumeId) {
        return perfumeReviewKeywordRepository
                .findKeywordCountsByPerfumeId(perfumeId, PageRequest.ofSize(KNOWN_KEYWORD_HINT_SIZE))
                .stream()
                .map(KeywordCount::keyword)
                .toList();
    }

    /**
     * 키워드를 적재할 수 있는 형태로 다듬습니다.
     *
     * <p>모델의 출력이므로 그대로 믿지 않습니다. 보내지 않은 후기 번호, 빈 문자열, 어휘 컬럼보다
     * 긴 이름, 같은 후기에 같은 키워드가 두 번 오는 경우가 모두 실제로 나옵니다.
     *
     * <p>보내지 않은 후기 번호는 버립니다. 모델이 만들어낸 번호일 수 있고, 그것이 다른 향수의
     * 후기 번호면 엉뚱한 향수의 키워드 통계가 바뀝니다.
     *
     * <p>같은 후기 번호가 두 번 오면 앞의 것만 씁니다. 합치면 후기 하나의 키워드 수 제한이
     * 무너집니다.
     */
    private Map<Long, List<String>> normalizeKeywords(
            Long perfumeId,
            ExtractedKeywords extracted,
            Set<Long> extractedReviewIds
    ) {
        Map<Long, List<String>> keywordsByReviewId = new LinkedHashMap<>();

        for (ReviewKeywords reviewKeywords : extracted.reviewKeywords()) {
            Long reviewId = reviewKeywords.reviewId();
            if (reviewId == null || !extractedReviewIds.contains(reviewId)) {
                log.warn(
                        "Review keyword extraction returned unknown review: perfumeId={}, reviewId={}",
                        perfumeId,
                        reviewId
                );
                continue;
            }

            List<String> names = reviewKeywords.keywords().stream()
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
