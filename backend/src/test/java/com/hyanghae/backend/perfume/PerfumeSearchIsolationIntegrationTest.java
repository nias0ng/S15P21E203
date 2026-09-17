package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import com.hyanghae.backend.perfume.dto.request.PerfumeSearchCondition;
import com.hyanghae.backend.perfume.repository.PerfumeScentFamilyRepository;
import com.hyanghae.backend.perfume.service.PerfumeService;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * 검색이 목록과 전체 개수를 같은 스냅샷에서 보는지 확인합니다.
 *
 * <p>관련 게시글({@link PerfumePostsConcurrencyIntegrationTest})처럼 두 쿼리 사이에 삽입을 끼워
 * 넣는 방식은 여기서 쓸 수 없습니다. 검색은 Spring Data 의 {@code Page} 가 목록과 개수를 한 번의
 * 메서드 호출 안에서 처리해, 그 사이에 끼어들 자리가 없습니다.
 *
 * <p>그래서 대신 트랜잭션이 실제로 어떤 격리 수준으로 열렸는지를 확인합니다. 두 쿼리가 같은
 * 스냅샷을 보는 근거가 격리 수준이므로, 그것이 적용됐는지가 검증할 수 있는 지점입니다. 왜 그것이
 * 필요한지는 관련 게시글 테스트가 실제 어긋남으로 보여줍니다.
 */
@IntegrationTest
class PerfumeSearchIsolationIntegrationTest {

    @Autowired
    private PerfumeService perfumeService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 검색이 같은 트랜잭션 안에서 호출하는 구체 클래스입니다. Spring Data 리포지토리는 인터페이스라
     * Mockito 가 실제 메서드를 부를 수 없어 감시 지점으로 쓸 수 없습니다.
     */
    @MockitoSpyBean
    private PerfumeScentFamilyRepository perfumeScentFamilyRepository;

    @BeforeEach
    void insertFixtures() {
        clearData();
        insertBrand(1, "Chanel");
        insertPerfume(1, "Bleu de Chanel");
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * 조회가 열린 트랜잭션의 격리 수준을 트랜잭션 안에서 직접 물어봅니다. 같은 스레드에서
     * {@code JdbcTemplate} 을 쓰면 Spring 이 진행 중인 트랜잭션의 커넥션을 물려주므로, 그 커넥션의
     * 설정이 곧 조회가 쓰는 설정입니다.
     */
    @Test
    void opensSearchTransactionAsRepeatableRead() {
        AtomicReference<String> isolation = new AtomicReference<>();
        doAnswer(invocation -> {
            isolation.set(currentIsolationLevel());
            return invocation.callRealMethod();
        }).when(perfumeScentFamilyRepository).findByPerfumeIds(any());

        perfumeService.search(
                new PerfumeSearchCondition("bleu", null, null, null, null), PageRequest.of(0, 20));

        assertThat(isolation.get())
                .as("감시 지점이 호출되지 않았거나 격리 수준이 다릅니다")
                .isEqualTo("repeatable read");
    }

    private String currentIsolationLevel() {
        return jdbcTemplate.queryForObject("SHOW transaction_isolation", String.class);
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active)"
                        + " VALUES (?, 1, ?, true)",
                id, name);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
