package com.hyanghae.backend.recommendation.service;

import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 향 특성(accord)의 영어 이름을 화면에 보여줄 이름으로 바꿉니다.
 *
 * <p><b>⚠ 이 클래스는 아직 제 일을 못 합니다. 한국어 이름표가 없습니다.</b>
 *
 * <p>추천 이유({@code reasons[].evidence})는 "이 향수가 어느 향 특성에 맞아서 나왔는가" 를
 * 사용자에게 보여주는 자리입니다. 그런데 검색이 쓰는 이름은 {@code soapy}·{@code fresh} 같은
 * 영어이고, <b>계약서는 이 값을 사용자에게 노출하지 않는다고 정했습니다.</b> 보여줄 한국어
 * 이름은 향 특성 92개에 붙이기로 했으나 아직 만들어지지 않았습니다 (연동 브리핑 안건 2).
 *
 * <p>그래서 지금은 <b>영어 이름을 그대로 돌려줍니다.</b> 임시로 계약을 어기는 상태이고,
 * 화면에는 {@code "soapy · fresh"} 가 나갑니다. 이유를 감추는 것보다는 낫다고 보고
 * 그렇게 두었습니다 — 비워 두면 프론트가 추천 이유 UI 자체를 만들 수 없습니다.
 *
 * <h2>한국어 이름표가 오면</h2>
 * <p><b>이 파일 하나만 고치면 됩니다.</b> 서비스도 응답 DTO 도 그대로입니다.
 * 받는 형태에 따라 둘 중 하나입니다.
 * <ul>
 *   <li>AI 가 표(CSV·JSON)로 주면 → {@link #KOREAN_NAMES} 를 그 값으로 채웁니다.</li>
 *   <li>{@code accords} 테이블에 {@code name_ko} 컬럼이 생기면 → Flyway 마이그레이션을
 *       더하고 이 클래스가 그 테이블을 읽게 바꿉니다.</li>
 * </ul>
 *
 * <p>어느 쪽이든 {@link #label(String)} 의 계약은 안 바뀝니다. 모르는 향 특성이 오면 영어
 * 이름으로 내려가므로, 표가 92개를 다 채우지 못해도 그만큼만 영어로 나갑니다.
 */
@Component
public class AccordLabeler {

    /**
     * 향 특성의 한국어 이름입니다. <b>아직 비어 있습니다.</b>
     *
     * <p>일부러 채우지 않았습니다. 이름을 붙이는 일은 AI 담당의 작업 범위이고, 백엔드가 임의로
     * 92개를 지어 두면 나중에 두 벌이 생겨 어느 쪽이 기준인지 흐려집니다.
     *
     * <p>{@code ai/data/accord_dictionary.csv} 에 향 특성 92개의 마스터가 있지만 통계 칸만
     * 있고 한국어 이름이 없습니다. {@code accords} 테이블도 {@code name}(영문)과
     * {@code is_active} 뿐입니다. 저장소 어디에도 재료가 없다는 뜻입니다.
     */
    private static final Map<String, String> KOREAN_NAMES = Map.of();

    /**
     * 화면에 보여줄 이름을 돌려줍니다. 모르는 향 특성이면 받은 값을 그대로 돌려줍니다.
     *
     * @param accord 향 특성의 영어 이름입니다.
     * @return 보여줄 이름입니다. {@code accord} 가 {@code null} 이거나 비어 있으면 {@code null}
     *         입니다 — 이유 한 줄을 만들 수 없으므로 호출한 쪽이 그 줄을 버려야 합니다.
     */
    public String label(String accord) {
        if (accord == null || accord.isBlank()) {
            return null;
        }
        return KOREAN_NAMES.getOrDefault(accord, accord);
    }
}
