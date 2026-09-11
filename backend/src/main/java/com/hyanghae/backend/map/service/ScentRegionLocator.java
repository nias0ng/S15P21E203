package com.hyanghae.backend.map.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.hyanghae.backend.map.repository.ScentMapRepository;
import com.hyanghae.backend.map.repository.ScentRegionRow;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 지도 위의 한 점이 어느 향 계열 영역에 있는지 판정합니다.
 *
 * <p>배는 향수를 눌러도, 빈 바다를 눌러도 움직입니다. 그 자리가 어느 구역인지는 좌표로만 알 수
 * 있고, 기록을 남길 때와 향해 일지를 읽을 때 같은 답이 나와야 합니다. 그래서 판정 규칙을 여기
 * 한 곳에 둡니다.
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
 *
 * <p>폴리곤을 캐시하지 않고 호출마다 읽습니다. 계열 9개에 꼭짓점 1692개라 읽고 푸는 비용이 크지
 * 않고, 캐시를 두면 적재로 지도를 바꿨을 때 재시작 전까지 옛 모양으로 판정합니다. 클릭마다 이
 * 질의가 부담이 되면 그때 캐시와 무효화 방법을 함께 정하는 편이 낫습니다.
 */
@Component
public class ScentRegionLocator {

    private static final TypeReference<List<List<List<Double>>>> POLYGON_TYPE =
            new TypeReference<>() {
            };

    private final ScentMapRepository scentMapRepository;
    private final ObjectMapper objectMapper;

    public ScentRegionLocator(ScentMapRepository scentMapRepository, ObjectMapper objectMapper) {
        this.scentMapRepository = scentMapRepository;
        this.objectMapper = objectMapper;
    }

    /** 좌표가 속한 향 계열 영역입니다. 계열 영역 밖의 바다는 비어 있습니다. */
    public Optional<Long> regionIdAt(double x, double y) {
        return scentMapRepository.findActiveRegions().stream()
                .filter(region -> contains(region, x, y))
                .map(ScentRegionRow::scentRegionId)
                .findFirst();
    }

    private boolean contains(ScentRegionRow region, double x, double y) {
        if (region.polygonJson() == null) {
            return false;
        }
        return parse(region).stream().anyMatch(piece -> containsInPiece(piece, x, y));
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

    /**
     * 저장된 폴리곤을 좌표 목록으로 읽습니다.
     *
     * <p>읽을 수 없으면 적재가 잘못된 것입니다. 그 영역만 건너뛰면 그 구역에 들어간 사용자의
     * 기록이 조용히 바다로 남으므로, 실패로 처리해 적재를 고치게 합니다.
     */
    private List<List<List<Double>>> parse(ScentRegionRow region) {
        try {
            return objectMapper.readValue(region.polygonJson(), POLYGON_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "향 계열 영역의 polygon 을 읽을 수 없습니다: scentRegionId="
                            + region.scentRegionId(),
                    exception
            );
        }
    }
}
