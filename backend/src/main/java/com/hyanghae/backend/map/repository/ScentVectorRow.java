package com.hyanghae.backend.map.repository;

/**
 * 계열 벡터 질의가 돌려주는 한 줄입니다. <b>향수 하나에 여러 줄</b>입니다.
 *
 * <p>향수 하나가 계열을 1~3개 가지므로 조인 결과가 그만큼 늘어납니다. 이 줄들을 향수별로 묶어
 * {@code families} 맵을 만드는 일은 서비스가 합니다.
 *
 * <p>한 질의로 읽고 자바에서 묶습니다. 향수마다 계열을 따로 조회하면 200번이 나가고, SQL 에서
 * JSON 으로 모으면 돌려받은 문자열을 다시 풀어야 합니다.
 */
public record ScentVectorRow(
        Long perfumeId,
        double x,
        double y,
        int rank,
        String familyCode,
        double weight
) {
}
