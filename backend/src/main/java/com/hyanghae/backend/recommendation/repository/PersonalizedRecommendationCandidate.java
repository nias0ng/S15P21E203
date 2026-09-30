package com.hyanghae.backend.recommendation.repository;

import java.time.OffsetDateTime;

/**
 * 취향 점수 상위 후보 한 건입니다.
 *
 * @param name           보여줄 이름입니다. 한국어 이름이 있으면 한국어, 없으면 원래 이름입니다.
 * @param originalName   {@code perfumes.name} 원래 이름입니다.
 * @param nameKo         {@code perfumes.name_ko} 입니다. 비어 있으면 {@code null} 입니다.
 * @param evidenceSource 가장 큰 근거의 출처입니다. {@code TASTE} · {@code FIT} · {@code RECENT}.
 * @param evidenceName   근거의 이름입니다. {@code TASTE} 면 향 계열의 한국어 이름, 나머지는
 *                       어코드 이름({@code accords.name}, 영어)입니다.
 * @param evidenceKey    근거를 언어와 상관없이 가리키는 값입니다. {@code TASTE} 면 향 계열
 *                       {@code scent_regions.code}, 나머지는 어코드 이름입니다.
 */
public record PersonalizedRecommendationCandidate(
        Long perfumeId,
        String name,
        String originalName,
        String nameKo,
        String imageUrl,
        double score,
        String evidenceSource,
        String evidenceName,
        String evidenceKey,
        OffsetDateTime lastRecommendedAt
) {
}
