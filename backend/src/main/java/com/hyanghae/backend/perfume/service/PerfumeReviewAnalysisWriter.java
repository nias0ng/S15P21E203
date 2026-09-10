package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.entity.PerfumeReviewKeyword;
import com.hyanghae.backend.perfume.entity.PerfumeReviewSummary;
import com.hyanghae.backend.perfume.entity.ReviewKeyword;
import com.hyanghae.backend.perfume.repository.PerfumeReviewKeywordRepository;
import com.hyanghae.backend.perfume.repository.PerfumeReviewSummaryRepository;
import com.hyanghae.backend.perfume.repository.ReviewKeywordRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 분석 결과를 데이터베이스에 적재합니다.
 *
 * <p>배치와 나눠 둔 이유는 트랜잭션 경계입니다. AI 호출은 수십 초가 걸릴 수 있어 트랜잭션 안에
 * 둘 수 없습니다. 같은 클래스의 메서드를 불러서는 {@code @Transactional} 이 걸리지 않으므로
 * ({@code this} 호출은 프록시를 지나지 않습니다) 적재만 떼어 다른 빈으로 두었습니다.
 *
 * <p>요약과 키워드는 한 트랜잭션입니다. 요약만 저장되고 키워드가 실패하면
 * {@code source_review_count} 가 올라가 재생성 대상에서 빠지고, 키워드는 영구히 비어 있게
 * 됩니다.
 */
@Service
public class PerfumeReviewAnalysisWriter {

    private final PerfumeReviewSummaryRepository perfumeReviewSummaryRepository;
    private final ReviewKeywordRepository reviewKeywordRepository;
    private final PerfumeReviewKeywordRepository perfumeReviewKeywordRepository;

    public PerfumeReviewAnalysisWriter(
            PerfumeReviewSummaryRepository perfumeReviewSummaryRepository,
            ReviewKeywordRepository reviewKeywordRepository,
            PerfumeReviewKeywordRepository perfumeReviewKeywordRepository
    ) {
        this.perfumeReviewSummaryRepository = perfumeReviewSummaryRepository;
        this.reviewKeywordRepository = reviewKeywordRepository;
        this.perfumeReviewKeywordRepository = perfumeReviewKeywordRepository;
    }

    @Transactional
    public void write(PerfumeReviewAnalysis analysis) {
        Instant analyzedAt = Instant.now();

        saveSummary(analysis, analyzedAt);
        replaceKeywords(analysis);
    }

    /**
     * 기존 행이 있으면 갱신하고 없으면 새로 만듭니다.
     *
     * <p>기본키를 애플리케이션이 정하므로 {@code save} 만으로는 신규와 갱신이 구분되지 않습니다.
     * 새 인스턴스로 덮어쓰면 {@code created_at} 이 매번 바뀌어 요약이 언제부터 있었는지 알 수
     * 없게 됩니다.
     */
    private void saveSummary(PerfumeReviewAnalysis analysis, Instant analyzedAt) {
        perfumeReviewSummaryRepository.findById(analysis.perfumeId())
                .ifPresentOrElse(
                        summary -> summary.update(
                                analysis.summary(), analysis.sourceReviewCount(), analyzedAt),
                        () -> perfumeReviewSummaryRepository.save(PerfumeReviewSummary.of(
                                analysis.perfumeId(),
                                analysis.summary(),
                                analysis.sourceReviewCount(),
                                analyzedAt
                        ))
                );
    }

    /**
     * 이번에 분석한 후기의 키워드를 이번 결과로 바꿉니다.
     *
     * <p>지우고 다시 넣으므로 같은 후기를 몇 번 분석해도 결과가 마지막 분석 하나입니다. 더하기만
     * 하면 실행마다 조금씩 다른 AI 응답이 쌓여 키워드별 비중이 실제보다 커집니다.
     */
    private void replaceKeywords(PerfumeReviewAnalysis analysis) {
        if (analysis.analyzedReviewIds().isEmpty()) {
            return;
        }

        perfumeReviewKeywordRepository.deleteByReviewIdIn(analysis.analyzedReviewIds());

        Map<Long, List<String>> keywordsByReviewId = analysis.keywordsByReviewId();
        if (keywordsByReviewId.isEmpty()) {
            return;
        }

        Map<String, Long> keywordIdsByName = resolveKeywordIds(distinctNames(keywordsByReviewId));

        List<PerfumeReviewKeyword> links = new ArrayList<>();
        keywordsByReviewId.forEach((reviewId, names) -> names.forEach(name ->
                links.add(PerfumeReviewKeyword.of(reviewId, keywordIdsByName.get(name)))));
        perfumeReviewKeywordRepository.saveAll(links);
    }

    private Set<String> distinctNames(Map<Long, List<String>> keywordsByReviewId) {
        Set<String> names = new LinkedHashSet<>();
        keywordsByReviewId.values().forEach(names::addAll);
        return names;
    }

    /**
     * 키워드 이름을 어휘의 번호로 바꿉니다. 어휘에 없는 이름은 새로 만듭니다.
     *
     * <p>이름을 하나씩 조회하지 않고 한 번에 가져옵니다. 후기 50건에 후기마다 키워드가 다섯
     * 개면 조회가 250번 나갑니다.
     *
     * <p>이름에 유니크 제약이 있어 같은 이름이 두 행으로 갈라지지는 않습니다. 배치 인스턴스가
     * 둘이면 제약 위반으로 실패할 수 있는데, 그 향수만 다음 실행에서 다시 시도됩니다.
     */
    private Map<String, Long> resolveKeywordIds(Set<String> names) {
        Map<String, Long> keywordIdsByName = new HashMap<>();
        reviewKeywordRepository.findByNameIn(names)
                .forEach(keyword -> keywordIdsByName.put(keyword.name(), keyword.id()));

        names.stream()
                .filter(name -> !keywordIdsByName.containsKey(name))
                .forEach(name -> {
                    ReviewKeyword saved = reviewKeywordRepository.save(ReviewKeyword.of(name));
                    keywordIdsByName.put(saved.name(), saved.id());
                });

        return keywordIdsByName;
    }
}
