package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import com.hyanghae.backend.recommendation.service.PersonalizedRecommendationCacheInspector.CacheSnapshot;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 한 사용자당 한 요청만 후보를 다시 계산하고 결과를 원자적으로 교체합니다. */
@Service
public class PersonalizedRecommendationRefresher {

    private static final int CANDIDATE_LIMIT = 10;

    private final PersonalizedRecommendationRepository repository;
    private final PersonalizedRecommendationCacheInspector cacheInspector;

    public PersonalizedRecommendationRefresher(
            PersonalizedRecommendationRepository repository,
            PersonalizedRecommendationCacheInspector cacheInspector
    ) {
        this.repository = repository;
        this.cacheInspector = cacheInspector;
    }

    @Transactional
    public CacheSnapshot refresh(Long userId, OffsetDateTime now) {
        if (!repository.tryLockForUser(userId)) {
            throw new BusinessException(
                    RecommendationErrorCode.RECOMMENDATION_REFRESH_IN_PROGRESS);
        }

        CacheSnapshot afterLock = cacheInspector.inspect(userId, now);
        if (!afterLock.refreshRequired()) {
            return afterLock;
        }

        long sourceVersion = repository.ensureCacheStateAndGetSourceVersion(userId);
        long lastViewId = repository.findMaxViewId(userId);
        List<PersonalizedRecommendationCandidate> candidates =
                repository.findTopCandidates(userId, CANDIDATE_LIMIT);
        repository.replaceCache(userId, candidates, sourceVersion, lastViewId, now);
        return new CacheSnapshot(false, candidates.isEmpty(), candidates);
    }
}
