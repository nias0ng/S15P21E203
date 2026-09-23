package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.recommendation.config.PersonalizedRecommendationProperties;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCacheState;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** 저장 후보가 아직 계산 입력을 충분히 반영하는지 판단합니다. */
@Component
public class PersonalizedRecommendationCacheInspector {

    private final PersonalizedRecommendationRepository repository;
    private final PersonalizedRecommendationProperties properties;

    public PersonalizedRecommendationCacheInspector(
            PersonalizedRecommendationRepository repository,
            PersonalizedRecommendationProperties properties
    ) {
        this.repository = repository;
        this.properties = properties;
    }

    public CacheSnapshot inspect(Long userId, OffsetDateTime now) {
        Optional<PersonalizedRecommendationCacheState> found = repository.findCacheState(userId);
        if (found.isEmpty()) {
            return CacheSnapshot.missing();
        }

        PersonalizedRecommendationCacheState state = found.get();
        List<PersonalizedRecommendationCandidate> candidates =
                repository.findCachedCandidates(userId);
        boolean refreshRequired = state.calculatedSourceVersion() == null
                || state.sourceVersion() != state.calculatedSourceVersion()
                || state.calculatedAt() == null
                || !state.calculatedAt().plus(properties.maxAge()).isAfter(now)
                || repository.hasViewThresholdAfter(
                        userId,
                        state.lastViewId(),
                        properties.viewRefreshThreshold())
                || (state.isReadyResult() && candidates.isEmpty())
                || (!state.isReadyResult() && !state.isEmptyResult());

        return new CacheSnapshot(refreshRequired, state.isEmptyResult(), candidates);
    }

    public record CacheSnapshot(
            boolean refreshRequired,
            boolean emptyResult,
            List<PersonalizedRecommendationCandidate> candidates
    ) {

        private static CacheSnapshot missing() {
            return new CacheSnapshot(true, false, List.of());
        }
    }
}
