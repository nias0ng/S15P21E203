package com.hyanghae.backend.map.dto.request;

/**
 * 향 지도에서 지금 화면에 보이는 사각형입니다. 쿼리 파라미터를 {@code @ModelAttribute} 로 받습니다.
 *
 * <p>네 값 모두 선택입니다. 하나도 주지 않으면 지도에 있는 향수 전체가 나갑니다.
 *
 * <p><b>지금 화면은 이 범위를 쓰지 않습니다.</b> 지도에 올리는 향수가 200개로 고정이라 화면이
 * 전체를 한 번 받아 두고, 배와 가까운 향수를 화면에서 직접 고릅니다. 배가 움직일 때마다 서버에
 * 물으면 그만큼 왕복이 생깁니다. 그래도 이 범위를 남겨 두는 것은 지도에 올리는 향수를 늘리는
 * 순간 필요해지기 때문입니다. 지웠다가 그때 다시 만드는 비용이 더 큽니다.
 *
 * <p>일부만 주는 것은 허용하지 않습니다. 예를 들어 {@code minX} 만 주면 "왼쪽 경계만 걸린 조회"가
 * 되는데, 그렇게 쓸 화면이 없고 나머지 세 값을 빠뜨린 실수일 가능성이 훨씬 큽니다. 조용히 일부만
 * 걸어 주면 화면은 범위 조회가 된 줄로 압니다.
 *
 * <p>좌표계는 향수 좌표와 같은 0~1 입니다. 향 계열 영역의 폴리곤은 지도 바깥 여백까지 뻗어
 * 있어(x -0.05~1.05) 좌표계가 다릅니다. 그래서 이 범위는 향수에만 적용합니다.
 */
public record MapViewportCondition(Double minX, Double maxX, Double minY, Double maxY) {

    /** 네 값이 모두 없으면 범위를 걸지 않습니다. */
    public boolean isUnbounded() {
        return minX == null && maxX == null && minY == null && maxY == null;
    }

    /** 네 값이 모두 있어야 범위로 씁니다. */
    public boolean isComplete() {
        return minX != null && maxX != null && minY != null && maxY != null;
    }

    /**
     * 최솟값이 최댓값보다 큰 사각형입니다. 어떤 향수도 걸리지 않아 빈 목록이 나가는데, 화면에서는
     * "그 범위에 향수가 없다"와 구분되지 않습니다. {@link #isComplete()} 인 경우에만 의미가 있습니다.
     */
    public boolean isInverted() {
        return minX > maxX || minY > maxY;
    }
}
