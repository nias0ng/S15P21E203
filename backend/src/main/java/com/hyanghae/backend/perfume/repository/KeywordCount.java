package com.hyanghae.backend.perfume.repository;

/** 키워드별 후기 수 조회 결과입니다. 백분율은 서비스가 분모를 알고 계산합니다. */
public record KeywordCount(String keyword, long count) {
}
