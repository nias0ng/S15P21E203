package com.hyanghae.backend.map.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.map.dto.request.MapViewportCondition;
import com.hyanghae.backend.map.dto.response.MapPerfumeDetailResponse;
import com.hyanghae.backend.map.dto.response.MapPerfumeResponse;
import com.hyanghae.backend.map.dto.response.ScentMapResponse;
import com.hyanghae.backend.map.dto.response.ScentRegionResponse;
import com.hyanghae.backend.map.exception.MapErrorCode;
import com.hyanghae.backend.map.repository.ScentMapRepository;
import com.hyanghae.backend.map.repository.ScentRegionRow;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 향 지도 조회입니다.
 *
 * <p>로그인이 필요하지 않습니다. 요구사항 정의서 MAP-16 이 "비회원도 향 지도를 이용하여 향수를
 * 탐색할 수 있다"로 정하고 있습니다. 탐색 기록·현재 위치·상호작용처럼 사용자에게 매달리는 값은
 * 이 서비스가 다루지 않습니다.
 */
@Service
public class ScentMapService {

    private final ScentMapRepository scentMapRepository;
    private final ObjectMapper objectMapper;

    public ScentMapService(ScentMapRepository scentMapRepository, ObjectMapper objectMapper) {
        this.scentMapRepository = scentMapRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 계열 영역과 향수 좌표를 함께 돌려줍니다.
     *
     * <p>범위를 주면 향수만 그 사각형으로 자릅니다. 계열 영역은 항상 전체입니다.
     *
     * <p>범위를 일부만 주거나 최솟값이 최댓값보다 크면 400 입니다. 둘 다 빈 목록이나 전체 목록으로
     * 조용히 넘어갈 수 있는데, 그러면 화면은 범위 조회가 된 줄로 알고 "이 범위에 향수가 없다"와
     * 구분하지 못합니다.
     */
    @Transactional(readOnly = true)
    public ScentMapResponse getMap(MapViewportCondition viewport) {
        List<ScentRegionResponse> regions = scentMapRepository.findActiveRegions().stream()
                .map(this::toRegion)
                .toList();

        return new ScentMapResponse(regions, findPerfumes(viewport));
    }

    /**
     * 지도에서 선택한 향수의 요약입니다.
     *
     * <p>향수가 없을 때, 비활성일 때, 좌표가 없을 때를 모두 같은 404 로 답합니다. 세 경우 모두
     * "지도에 없는 향수"이고 화면이 할 일도 같습니다. 구분해 주면 어떤 향수가 존재하는지가
     * 응답으로 새어 나가기도 합니다.
     */
    @Transactional(readOnly = true)
    public MapPerfumeDetailResponse getPerfume(Long perfumeId) {
        return scentMapRepository.findPerfume(perfumeId)
                .orElseThrow(() -> new BusinessException(MapErrorCode.MAP_PERFUME_NOT_FOUND));
    }

    private List<MapPerfumeResponse> findPerfumes(MapViewportCondition viewport) {
        if (viewport.isUnbounded()) {
            return scentMapRepository.findPerfumes();
        }
        if (!viewport.isComplete()) {
            throw new BusinessException(MapErrorCode.MAP_VIEWPORT_INCOMPLETE);
        }
        if (viewport.isInverted()) {
            throw new BusinessException(MapErrorCode.MAP_VIEWPORT_INVERTED);
        }
        return scentMapRepository.findPerfumesIn(viewport);
    }

    /**
     * 저장된 폴리곤 JSON 을 그대로 응답에 실어 보냅니다.
     *
     * <p>JSON 으로 되돌리기만 하고 꼭짓점을 자바 타입으로 옮기지 않습니다. 서버가 좌표를 볼 일이
     * 없고, 옮겨 담으면 계열 9개에 1692개를 옮긴 뒤 다시 직렬화하게 됩니다.
     *
     * <p>읽을 수 없는 JSON 이 들어 있으면 적재가 잘못된 것입니다. 그 계열만 빼고 지도를 그리면
     * 영역 하나가 조용히 사라지므로, 실패로 처리해 적재를 고치게 합니다.
     */
    private ScentRegionResponse toRegion(ScentRegionRow row) {
        return new ScentRegionResponse(
                row.scentRegionId(),
                row.code(),
                row.name(),
                row.displayOrder(),
                row.anchorX(),
                row.anchorY(),
                toPolygon(row)
        );
    }

    private JsonNode toPolygon(ScentRegionRow row) {
        if (row.polygonJson() == null) {
            return null;
        }
        try {
            return objectMapper.readTree(row.polygonJson());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "향 계열 영역의 polygon 을 읽을 수 없습니다: scentRegionId=" + row.scentRegionId(),
                    exception
            );
        }
    }
}
