package com.hyanghae.backend.map.dto.request;

/**
 * 배를 어디로 옮기라는 요청입니다. 지도에서 클릭 한 번에 하나씩 보냅니다.
 *
 * <p>클릭은 두 가지입니다. 향수를 고르면 {@code perfumeId} 를 보내고, 빈 바다를 고르면
 * {@code x}·{@code y} 를 보냅니다.
 *
 * <p>향수를 고른 경우 좌표는 보내지 않아도 됩니다. 보내더라도 서버가 {@code perfume_map_points}
 * 에서 그 향수의 좌표를 읽어 씁니다. 지도에 찍힌 자리와 기록에 남는 자리가 어긋나지 않게 하려는
 * 것입니다.
 *
 * <p>둘 다 없으면 400 입니다. 어디로 움직였는지 모르는 기록은 남길 수 없습니다.
 */
public record ExplorationMoveRequest(Long perfumeId, Double x, Double y) {

    /** 향수를 고른 클릭입니다. 좌표는 서버가 채웁니다. */
    public boolean isPerfumeVisit() {
        return perfumeId != null;
    }

    /** 빈 바다를 고른 클릭입니다. 좌표가 있어야 어디로 갔는지 알 수 있습니다. */
    public boolean hasCoordinate() {
        return x != null && y != null;
    }
}
