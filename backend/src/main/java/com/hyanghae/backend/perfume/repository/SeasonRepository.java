package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.Season;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonRepository extends JpaRepository<Season, Long> {

    List<Season> findAllByIdInAndActiveTrue(Collection<Long> seasonIds);

    /**
     * 코드로 계절을 찾습니다. 후기가 번호가 아니라 코드로 계절을 고릅니다.
     *
     * <p>{@code season_id} 는 자동 증가라 환경마다 다른 값이 붙을 수 있어 화면이 번호를 알 수
     * 없습니다. 코드는 V18 이 고정했고 {@code uk_seasons_code} 가 하나뿐임을 보장합니다.
     *
     * <p>없는 코드는 결과에 나오지 않습니다. 부르는 쪽이 개수를 견줘 판단합니다.
     */
    List<Season> findAllByCodeInAndActiveTrue(Collection<String> codes);
}
