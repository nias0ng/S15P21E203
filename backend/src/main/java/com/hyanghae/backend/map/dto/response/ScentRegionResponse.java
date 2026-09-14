package com.hyanghae.backend.map.dto.response;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * 지도 위의 향 계열 영역 하나입니다.
 *
 * <p>{@code polygon} 은 {@code [[[x,y], ...], ...]} 형태로, 계열마다 조각이 1~5개입니다. 영역이
 * 사각형이 아니라 지도 위에 불규칙하게 퍼져 있어 조각들의 목록으로 받습니다.
 *
 * <p>서버가 해석할 일이 없어 저장된 JSON 을 그대로 통과시킵니다. 꼭짓점을 자바 타입으로 옮겨
 * 담으면 계열 9개에 1692개를 옮기고 다시 직렬화하게 되고, 그 과정에서 좌표가 바뀌지 않는다는
 * 보장을 따로 지켜야 합니다.
 *
 * <p>{@code anchorX}·{@code anchorY} 는 계열 이름을 적을 위치입니다. 폴리곤의 무게중심과 다를 수
 * 있어 따로 옵니다. {@code displayOrder} 는 지도 범례의 순서입니다.
 *
 * <p>이 좌표들은 향수 좌표와 좌표계가 달라 0~1 을 벗어납니다(x -0.05~1.05, y -0.04565~0.88056).
 */
public record ScentRegionResponse(
        Long scentRegionId,
        String code,
        String name,
        Integer displayOrder,
        Double anchorX,
        Double anchorY,
        JsonNode polygon
) {
}
