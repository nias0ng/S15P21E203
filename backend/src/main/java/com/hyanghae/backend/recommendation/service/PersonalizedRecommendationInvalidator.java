package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 적합도나 취향 선택이 실제로 바뀌었음을 후보 버전에 남깁니다. */
@Service
public class PersonalizedRecommendationInvalidator {

    private final PersonalizedRecommendationRepository repository;

    public PersonalizedRecommendationInvalidator(PersonalizedRecommendationRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void invalidate(Long userId) {
        repository.incrementSourceVersion(userId);
    }
}
