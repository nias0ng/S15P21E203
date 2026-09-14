package com.hyanghae.backend.map.dto.response;

import java.util.List;

/**
 * 향해 일지입니다. 최근 구역 진입부터 나옵니다.
 *
 * <p>계열 영역 밖의 바다로 나간 이동은 줄로 나오지 않습니다. 일지에 그릴 구역이 없기 때문입니다.
 * 다만 그 이동이 구역을 끊으므로, 바다로 나갔다 같은 구역으로 돌아오면 진입이 두 줄이 됩니다.
 */
public record VoyageLogResponse(List<VoyageLogEntryResponse> entries) {
}
