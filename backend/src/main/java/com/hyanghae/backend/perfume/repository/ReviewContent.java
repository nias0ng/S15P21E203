package com.hyanghae.backend.perfume.repository;

/**
 * AI 에게 보낼 후기 원문입니다.
 *
 * <p>{@code reviewId} 를 함께 들고 가는 이유가 있습니다. 키워드는 향수가 아니라 후기에 붙는데
 * ({@code perfume_review_keywords} 의 기본키가 {@code (review_id, keyword_id)}),
 * 어느 후기에서 나온 표현인지 알아야 그 행을 만들 수 있습니다.
 *
 * <p>작성자는 담지 않습니다. AI 에게 보낼 필요가 없는 개인정보입니다.
 */
public record ReviewContent(Long reviewId, String title, String content) {
}
