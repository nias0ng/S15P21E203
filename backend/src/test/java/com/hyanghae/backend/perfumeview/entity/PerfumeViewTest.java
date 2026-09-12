package com.hyanghae.backend.perfumeview.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.hyanghae.backend.perfume.entity.Perfume;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PerfumeViewTest {

    @Test
    void calculatesDurationOnlyOnFirstExit() {
        Instant viewedAt = Instant.parse("2026-09-12T00:00:00Z");
        PerfumeView perfumeView = PerfumeView.create(
                1L,
                mock(Perfume.class),
                PerfumeViewSourceType.SCENT_MAP,
                null,
                viewedAt
        );

        perfumeView.exit(viewedAt.plusSeconds(12));
        perfumeView.exit(viewedAt.plusSeconds(30));

        assertThat(perfumeView.getExitedAt()).isEqualTo(viewedAt.plusSeconds(12));
        assertThat(perfumeView.getDurationSeconds()).isEqualTo(12);
    }
}
