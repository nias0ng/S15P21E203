package com.hyanghae.backend.map.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.map.repository.ScentMapRepository;
import com.hyanghae.backend.map.repository.ScentRegionRow;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 향 계열 영역의 폴리곤을 읽어, 좌표를 판정할 수 있는 지도({@link ScentRegions})를 만듭니다.
 *
 * <p>배는 향수를 눌러도, 빈 바다를 눌러도 움직입니다. 그 자리가 어느 구역인지는 좌표로만 알 수
 * 있고, 기록을 남길 때와 향해 일지를 읽을 때 같은 답이 나와야 합니다. 그래서 판정 규칙을 여기
 * 한 곳에 둡니다.
 *
 * <p>캐시하지 않고 요청마다 읽습니다. 계열 9개에 꼭짓점 1692개라 읽고 푸는 비용이 크지 않고,
 * 캐시를 두면 적재로 지도를 바꿨을 때 재시작 전까지 옛 모양으로 판정합니다. 부담이 되면 그때
 * 캐시와 무효화 방법을 함께 정하는 편이 낫습니다.
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

    /**
     * 지금 적재된 계열 영역으로 지도를 만듭니다. 한 요청에서 한 번 부르고 여러 좌표를 판정합니다.
     *
     * <p>폴리곤이 아직 적재되지 않은 계열은 빠집니다. 계열 9개가 존재한다는 사실은 마이그레이션이
     * 정하고, 지도를 다시 만들 때마다 바뀌는 폴리곤은 적재가 채웁니다.
     */
    public ScentRegions load() {
        return new ScentRegions(scentMapRepository.findActiveRegions().stream()
                .filter(row -> row.polygonJson() != null)
                .map(this::toRegion)
                .toList());
    }

    /**
     * 저장된 폴리곤을 좌표 목록으로 읽습니다.
     *
     * <p>읽을 수 없으면 적재가 잘못된 것입니다. 그 영역만 건너뛰면 그 구역에 들어간 사용자의
     * 기록이 조용히 바다로 남으므로, 실패로 처리해 적재를 고치게 합니다.
     */
    private ScentRegions.Region toRegion(ScentRegionRow row) {
        try {
            return new ScentRegions.Region(
                    new ScentRegionRef(row.scentRegionId(), row.code()),
                    objectMapper.readValue(row.polygonJson(), POLYGON_TYPE)
            );
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "향 계열 영역의 polygon 을 읽을 수 없습니다: scentRegionId="
                            + row.scentRegionId(),
                    exception
            );
        }
    }
}
