package com.hyanghae.backend.perfume.repository;

/** 계절별 후기 수 조회 결과입니다. 비율은 서비스가 분모를 알고 계산합니다. */
public record SeasonCount(Long seasonId, String code, String name, long count) {
}
