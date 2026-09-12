package com.hyanghae.backend.map.dto.response;

import java.time.OffsetDateTime;

/**
 * 배가 지금 떠 있는 자리입니다.
 *
 * <p>지도를 다시 열었을 때 배를 있던 자리에 돌려놓는 데 씁니다. 탐색 기록과 달리 사용자당 한
 * 줄이고, 배가 움직일 때마다 덮어씁니다.
 *
 * <p>한 번도 움직인 적이 없는 사용자는 세 필드가 모두 {@code null} 인 200 응답입니다. 404 로
 * 하면 화면이 "처음 온 사용자" 를 오류로 다뤄야 합니다. 후기 요약 조회가 같은 이유로 같은
 * 형태를 씁니다.
 */
public record ExplorationStateResponse(Double x, Double y, OffsetDateTime updatedAt) {

    /** 아직 움직인 적이 없는 사용자의 응답입니다. */
    public static ExplorationStateResponse empty() {
        return new ExplorationStateResponse(null, null, null);
    }

    /**
     * 저장하지 않고 자리만 알려주는 응답입니다. 비로그인 사용자의 이동에 씁니다.
     *
     * <p>{@code updatedAt} 이 비어 있는 것이 "남기지 않았다" 는 표시입니다. 저장한 시각이 없으니
     * 채울 값도 없습니다.
     */
    public static ExplorationStateResponse notSaved(double x, double y) {
        return new ExplorationStateResponse(x, y, null);
    }
}
