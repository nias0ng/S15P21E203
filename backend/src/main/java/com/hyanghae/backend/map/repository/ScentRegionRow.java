package com.hyanghae.backend.map.repository;

/**
 * {@code scent_regions} 한 행입니다.
 *
 * <p>{@code polygonJson} 은 데이터베이스에 있는 JSON 문자열 그대로입니다. 응답으로 나가기 전에
 * {@code ScentMapService} 가 JSON 으로 되돌립니다. 문자열로 한 번 거치는 이유는, 여기서 자바
 * 타입으로 옮겨 담으면 꼭짓점 1692개를 옮기고 다시 직렬화하게 되기 때문입니다.
 *
 * <p>폴리곤이 아직 적재되지 않은 계열은 {@code null} 입니다. 계열 9개가 존재한다는 사실은
 * 마이그레이션이 정하고, 지도를 다시 만들 때마다 바뀌는 폴리곤은 적재가 채웁니다.
 */
public record ScentRegionRow(
        Long scentRegionId,
        String code,
        String name,
        Integer displayOrder,
        Double anchorX,
        Double anchorY,
        String polygonJson
) {
}
