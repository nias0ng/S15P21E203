package com.hyanghae.backend.map.dto.response;

import java.util.List;

/**
 * 취향 테스트가 쓰는 계열 벡터 전체입니다.
 *
 * <p>페이지가 없습니다. 화면이 200개를 모두 받아 두고 브라우저에서 유사도를 잽니다. 나눠 받으면
 * 전부 모일 때까지 매칭을 시작할 수 없어 왕복만 늘어납니다.
 *
 * <p>배열을 그대로 내보내지 않는 이유는 다른 목록 응답과 같습니다. 나중에 이 자리에 값을 더해야
 * 할 때 응답 모양이 통째로 바뀌지 않습니다.
 *
 * <p>향수가 없으면 빈 배열입니다. {@code null} 이 아닙니다.
 */
public record ScentVectorsResponse(List<ScentVectorResponse> perfumes) {
}
