package com.hyanghae.backend.perfumeview.entity;

import com.hyanghae.backend.perfume.entity.Perfume;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;

@Entity
@Table(name = "user_perfume_views")
public class PerfumeView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "perfume_view_id")
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perfume_id")
    private Perfume perfume;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_location_type", length = 50)
    private PerfumeViewSourceType fromLocationType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_perfume_id")
    private Perfume fromPerfume;

    @Column(name = "viewed_at")
    private Instant viewedAt;

    @Column(name = "exited_at")
    private Instant exitedAt;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    protected PerfumeView() {
        // JPA가 요구하는 기본 생성자입니다.
    }

    public static PerfumeView create(
            Long userId,
            Perfume perfume,
            PerfumeViewSourceType fromLocationType,
            Perfume fromPerfume,
            Instant viewedAt
    ) {
        PerfumeView perfumeView = new PerfumeView();
        perfumeView.userId = userId;
        perfumeView.perfume = perfume;
        perfumeView.fromLocationType = fromLocationType;
        perfumeView.fromPerfume = fromPerfume;
        perfumeView.viewedAt = viewedAt;
        return perfumeView;
    }

    public void exit(Instant exitedAt) {
        if (this.exitedAt != null) {
            return;
        }

        long elapsedSeconds = Math.max(0L, Duration.between(viewedAt, exitedAt).getSeconds());
        this.exitedAt = exitedAt;
        this.durationSeconds = Math.toIntExact(Math.min(elapsedSeconds, Integer.MAX_VALUE));
    }

    public Long getId() {
        return id;
    }

    public Instant getViewedAt() {
        return viewedAt;
    }

    public Instant getExitedAt() {
        return exitedAt;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }
}
