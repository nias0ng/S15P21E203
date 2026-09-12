package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.Season;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonRepository extends JpaRepository<Season, Long> {

    List<Season> findAllByIdInAndActiveTrue(Collection<Long> seasonIds);
}
