package com.hyanghae.backend.map.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.map.dto.response.MapPerfumeResponse;
import com.hyanghae.backend.map.dto.response.ScentMapResponse;
import com.hyanghae.backend.map.repository.ScentMapRepository;
import com.hyanghae.backend.map.repository.ScentRegionRow;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 저장된 폴리곤을 응답으로 옮기는 규칙만 떼어 검증합니다.
 *
 * <p>데이터베이스 없이 봅니다. {@code scent_regions.polygon} 은 JSONB 라 PostgreSQL 이 쓰기
 * 시점에 JSON 문법을 검사합니다. 읽을 수 없는 문자열은 애초에 들어가지 않으므로 통합 테스트로는
 * 이 경로를 만들 수 없습니다. 그래도 검사를 남기는 이유는 컬럼 타입이 바뀌거나 다른 경로로
 * 값이 들어올 때를 위해서입니다. 여기서는 리포지토리를 대역으로 바꿔 그 상황을 만듭니다.
 *
 * <p>적재된 폴리곤이 실제로 어떻게 나가는지는 {@code ScentMapIntegrationTest} 가 봅니다.
 */
class ScentMapServiceTest {

    private static final long SCENT_REGION_ID = 9L;

    private final ScentMapRepository scentMapRepository = mock(ScentMapRepository.class);
    private final ScentMapService scentMapService = new ScentMapService(
            scentMapRepository, mock(ScentRegionLocator.class), new ObjectMapper());

    /**
     * 읽을 수 없는 폴리곤은 실패로 처리합니다.
     *
     * <p>그 계열만 빼고 지도를 그리면 영역 하나가 조용히 사라집니다. 화면에는 빈 자리가 남고
     * 원인을 찾을 단서가 없으므로, 적재가 잘못됐다는 사실이 드러나게 둡니다. 예외는
     * {@code GlobalExceptionHandler} 가 500 으로 바꿉니다.
     *
     * <p>메시지에 계열 번호를 담습니다. 폴리곤 본문을 남기면 로그가 꼭짓점 수백 개로 덮입니다.
     */
    @Test
    void failsWhenPolygonIsNotJson() {
        given(scentMapRepository.findActiveRegions())
                .willReturn(List.of(regionWithPolygon("깨진 값")));

        assertThatThrownBy(scentMapService::getMap)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("scentRegionId=" + SCENT_REGION_ID);
    }

    /**
     * 폴리곤이 없는 계열은 {@code null} 로 내보냅니다.
     *
     * <p>계열 9개가 존재한다는 사실은 마이그레이션이 정하고 폴리곤은 적재가 채웁니다. 적재 전에는
     * 비어 있는 것이 정상이라 실패로 다루지 않습니다.
     */
    @Test
    void servesRegionWithoutPolygon() {
        given(scentMapRepository.findActiveRegions())
                .willReturn(List.of(regionWithPolygon(null)));
        given(scentMapRepository.findPerfumes()).willReturn(List.<MapPerfumeResponse>of());

        ScentMapResponse response = scentMapService.getMap();

        assertThat(response.regions()).hasSize(1);
        assertThat(response.regions().getFirst().polygon()).isNull();
    }

    private ScentRegionRow regionWithPolygon(String polygonJson) {
        return new ScentRegionRow(
                SCENT_REGION_ID, "MUSK", "머스크", 8, 0.5, 0.6, polygonJson);
    }
}
