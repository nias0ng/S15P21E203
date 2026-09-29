package com.hyanghae.backend.user.repository;

import com.hyanghae.backend.user.entity.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByGoogleSubject(String googleSubject);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    boolean existsByGoogleSubject(String googleSubject);
}
