package com.hyanghae.backend.map.service;

import java.util.List;
import java.util.Optional;

/**
 * 어느 좌표가 어느 향 계열 영역인지 답하는, 한 시점의 지도입니다.
 *
 * <p>{@link ScentRegionLocator} 가 폴리곤을 한 번 읽어 만들고, 그 뒤로는 데이터베이스를 보지
 * 않습니다. 향해 일지는 기록 수십 줄을 한꺼번에 분류해야 해서, 줄마다 폴리곤을 다시 읽으면
 * 질의가 줄 수만큼 나갑니다.
 *
 * <p>판정은 광선 교차(ray casting)입니다. 점에서 오른쪽으로 반직선을 그어 다각형의 변과 몇 번
 * 만나는지 세고, 홀수면 안쪽입니다. 계열 영역은 조각이 1~5개인 다각형 묶음이라 조각 하나라도
 * 품고 있으면 그 계열입니다.
 *
 * <p>계열 영역은 서로 겹치지 않습니다. 인계 데이터의 향수 200개로 확인했고, 두 영역에 동시에
 * 들어가는 점은 없었습니다. 그래서 답은 영역 하나이거나 없거나입니다.
 *
 * <p>어느 영역에도 없는 좌표가 있습니다. 지도에는 계열 영역 밖의 바다가 있고, 실제로 향수 200개
 * 중 3개가 그런 자리에 있습니다. 그래서 답이 비어 있는 것은 오류가 아닙니다.
 */
public final class ScentRegions {

    private final List<Region> regions;

    ScentRegions(List<Region> regions) {
        this.regions = regions;
    }

    /** 좌표가 속한 향 계열 영역입니다. 계열 영역 밖의 바다는 비어 있습니다. */
    public Optional<ScentRegionRef> at(double x, double y) {
        return regions.stream()
                .filter(region -> region.contains(x, y))
                .map(Region::ref)
                .findFirst();
    }

    /** 좌표가 속한 향 계열 영역의 번호입니다. */
    public Optional<Long> idAt(double x, double y) {
        return at(x, y).map(ScentRegionRef::scentRegionId);
    }

    /** 계열 하나와 그 영역입니다. 영역은 조각들의 목록입니다. */
    record Region(ScentRegionRef ref, List<List<List<Double>>> polygon) {

        boolean contains(double x, double y) {
            return polygon.stream().anyMatch(piece -> containsInPiece(piece, x, y));
        }

        /**
         * 조각 하나에 대한 광선 교차입니다.
         *
         * <p>변의 두 끝점이 {@code y} 를 사이에 두고 있을 때만 교차를 셉니다. 위쪽 끝점은 포함하고
         * 아래쪽 끝점은 빼는 비대칭 비교라, 점이 꼭짓점과 같은 높이에 있어도 두 번 세지 않습니다.
         */
        private boolean containsInPiece(List<List<Double>> piece, double x, double y) {
            boolean inside = false;
            for (int i = 0, j = piece.size() - 1; i < piece.size(); j = i++) {
                double xi = piece.get(i).get(0);
                double yi = piece.get(i).get(1);
                double xj = piece.get(j).get(0);
                double yj = piece.get(j).get(1);

                boolean crosses = (yi > y) != (yj > y)
                        && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
                if (crosses) {
                    inside = !inside;
                }
            }
            return inside;
        }
    }
}
