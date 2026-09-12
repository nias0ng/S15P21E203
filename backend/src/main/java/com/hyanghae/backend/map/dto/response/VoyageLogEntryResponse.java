package com.hyanghae.backend.map.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 향해 일지 한 줄입니다. 배가 어느 향 구역에 들어간 사건 하나를 나타냅니다.
 *
 * <p>{@code entryId} 는 그 진입을 만든 기록의 번호입니다. 화면이 줄을 구분하는 데 씁니다.
 *
 * <p>{@code region} 은 계열 코드({@code CITRUS} 등)입니다. 번호도 함께 주지만 화면은 코드로
 * 색과 이름을 고릅니다.
 *
 * <p>{@code visited} 는 그 구역에 있는 동안 들른 향수입니다. 들르지 않고 지나가기만 했으면 빈
 * 목록입니다. 같은 향수를 여러 번 눌러도 한 번만 나옵니다.
 *
 * <p>향수의 대표 계열이 이 구역과 다를 수 있습니다. 폴리곤은 지도를 그리기 위해 뭉뚱그린 모양이라
 * 경계 근처 향수는 옆 구역에 앉아 있습니다(인계 데이터의 향수 200개 중 44개). 일지는 배가 떠 있던
 * 자리를 적는 것이라 배가 지나간 구역으로 묶습니다.
 */
public record VoyageLogEntryResponse(
        Long entryId,
        OffsetDateTime enteredAt,
        Long scentRegionId,
        String region,
        List<VisitedPerfumeResponse> visited
) {
}
