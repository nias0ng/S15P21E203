package com.hyanghae.backend.map.dto.response;

import java.time.OffsetDateTime;

/**
 * 기록한 탐색 로그 한 줄입니다.
 *
 * <p>{@code visitedAt} 은 데이터베이스가 넣은 시각입니다. 애플리케이션이 만든 시각을 쓰면
 * 인스턴스마다 시계가 조금씩 달라 같은 순간의 기록이 뒤섞여 보입니다.
 */
public record ExplorationLogCreateResponse(Long logId, OffsetDateTime visitedAt) {
}
