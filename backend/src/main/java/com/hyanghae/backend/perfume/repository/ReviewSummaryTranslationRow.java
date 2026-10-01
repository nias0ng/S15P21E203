package com.hyanghae.backend.perfume.repository;

import java.time.Instant;

/**
 * 저장해 둔 후기 요약 번역입니다.
 *
 * @param summaryText     번역한 요약입니다.
 * @param sourceUpdatedAt 번역할 때 쓴 한국어 요약의 갱신 시각입니다.
 */
public record ReviewSummaryTranslationRow(String summaryText, Instant sourceUpdatedAt) {
}
