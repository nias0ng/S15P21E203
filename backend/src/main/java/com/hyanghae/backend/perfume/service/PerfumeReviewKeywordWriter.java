package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.entity.PerfumeReviewKeyword;
import com.hyanghae.backend.perfume.entity.ReviewKeyword;
import com.hyanghae.backend.perfume.repository.PerfumeReviewKeywordRepository;
import com.hyanghae.backend.perfume.repository.PerfumeReviewRepository;
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
 * 추출한 키워드를 데이터베이스에 적재합니다.
 *
 * <p>배치와 나눠 둔 이유는 트랜잭션 경계입니다. AI 호출은 수십 초가 걸릴 수 있어 트랜잭션 안에
 * 둘 수 없습니다. 같은 클래스의 메서드를 불러서는 {@code @Transactional} 이 걸리지 않으므로
 * ({@code this} 호출은 프록시를 지나지 않습니다) 적재만 떼어 다른 빈으로 두었습니다.
 *
 * <p>키워드 적재와 추출 시각 기록은 한 트랜잭션입니다. 키워드만 저장되고 시각이 남지 않으면 그
 * 후기를 다음 주기에 다시 보내고, 시각만 남고 키워드가 실패하면 그 후기는 영구히 키워드가 없는
 * 채로 다시 시도되지 않습니다.
 */
@Service
public class PerfumeReviewKeywordWriter {

    private final PerfumeReviewRepository perfumeReviewRepository;
    private final ReviewKeywordRepository reviewKeywordRepository;
    private final PerfumeReviewKeywordRepository perfumeReviewKeywordRepository;

    public PerfumeReviewKeywordWriter(
            PerfumeReviewRepository perfumeReviewRepository,
            ReviewKeywordRepository reviewKeywordRepository,
            PerfumeReviewKeywordRepository perfumeReviewKeywordRepository
    ) {
        this.perfumeReviewRepository = perfumeReviewRepository;
        this.reviewKeywordRepository = reviewKeywordRepository;
        this.perfumeReviewKeywordRepository = perfumeReviewKeywordRepository;
    }

    @Transactional
    public void write(PerfumeReviewKeywords keywords) {
        if (keywords.extractedReviewIds().isEmpty()) {
            return;
        }

        replaceKeywords(keywords);
        perfumeReviewRepository.markKeywordsExtracted(
                keywords.extractedReviewIds(), Instant.now());
    }

    /**
     * 이번에 보낸 후기의 키워드를 이번 결과로 바꿉니다.
     *
     * <p>보낸 후기는 아직 키워드가 없던 것들이라 지울 것이 없습니다. 그래도 지우는 문장을 남겨
     * 두는 이유가 있습니다. 이 메서드의 약속이 "보낸 후기의 키워드는 이번 결과가 전부"인데,
     * 지우지 않으면 어떤 경로로든 남아 있던 행이 이번 결과와 섞입니다.
     */
    private void replaceKeywords(PerfumeReviewKeywords keywords) {
        perfumeReviewKeywordRepository.deleteByReviewIdIn(keywords.extractedReviewIds());

        Map<Long, List<String>> keywordsByReviewId = keywords.keywordsByReviewId();
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
     * <p>이름을 하나씩 조회하지 않고 한 번에 가져옵니다. 후기 20건에 후기마다 키워드가 다섯
     * 개면 조회가 100번 나갑니다.
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
