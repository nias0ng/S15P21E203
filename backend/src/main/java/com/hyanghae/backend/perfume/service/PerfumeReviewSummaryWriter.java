package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.entity.PerfumeReviewSummary;
import com.hyanghae.backend.perfume.repository.PerfumeReviewSummaryRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 생성한 요약을 데이터베이스에 적재합니다.
 *
 * <p>배치와 나눠 둔 이유는 트랜잭션 경계입니다. AI 호출은 수십 초가 걸릴 수 있어 트랜잭션 안에
 * 둘 수 없습니다. 같은 클래스의 메서드를 불러서는 {@code @Transactional} 이 걸리지 않으므로
 * (그 호출은 프록시를 지나지 않습니다) 적재만 떼어 다른 빈으로 두었습니다.
 */
@Service
public class PerfumeReviewSummaryWriter {

    private final PerfumeReviewSummaryRepository perfumeReviewSummaryRepository;

    public PerfumeReviewSummaryWriter(
            PerfumeReviewSummaryRepository perfumeReviewSummaryRepository
    ) {
        this.perfumeReviewSummaryRepository = perfumeReviewSummaryRepository;
    }

    /**
     * 기존 행이 있으면 갱신하고 없으면 새로 만듭니다.
     *
     * <p>기본키를 애플리케이션이 정하므로 {@code save} 만으로는 신규와 갱신이 구분되지 않습니다.
     * 새 인스턴스로 덮어쓰면 {@code created_at} 이 매번 바뀌어 요약이 언제부터 있었는지 알 수
     * 없게 됩니다.
     */
    @Transactional
    public void write(Long perfumeId, String summary, int sourceReviewCount) {
        Instant generatedAt = Instant.now();

        perfumeReviewSummaryRepository.findById(perfumeId)
                .ifPresentOrElse(
                        existing -> existing.update(summary, sourceReviewCount, generatedAt),
                        () -> perfumeReviewSummaryRepository.save(PerfumeReviewSummary.of(
                                perfumeId, summary, sourceReviewCount, generatedAt))
                );
    }
}
