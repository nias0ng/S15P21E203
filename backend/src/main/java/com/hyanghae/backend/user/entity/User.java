package com.hyanghae.backend.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long id;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "nickname", nullable = false, length = 20)
    private String nickname;

    /**
     * 프로필 사진의 주소입니다. {@code null} 은 설정하지 않은 상태이고, 화면이 기본
     * 아바타를 보여줍니다.
     *
     * <p>주소만 담습니다. 파일은 {@code UserProfileImageService} 가 저장하고 여기에는
     * 그 결과 주소가 들어옵니다.
     */
    @Column(name = "profile_image_url")
    private String profileImageUrl;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected User() {
    }

    private User(
            String email,
            String passwordHash,
            String nickname,
            OffsetDateTime createdAt
    ) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.nickname = nickname;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    public static User signup(
            String email,
            String passwordHash,
            String nickname,
            OffsetDateTime createdAt
    ) {
        return new User(email, passwordHash, nickname, createdAt);
    }

    public void changePassword(String passwordHash, OffsetDateTime updatedAt) {
        this.passwordHash = passwordHash;
        this.updatedAt = updatedAt;
    }

    public void changeNickname(String nickname, OffsetDateTime updatedAt) {
        this.nickname = nickname;
        this.updatedAt = updatedAt;
    }

    /**
     * 프로필 사진을 바꿉니다. {@code null} 을 주면 설정하지 않은 상태로 되돌립니다.
     *
     * <p><b>옛 파일을 지우는 것은 부르는 쪽의 몫입니다.</b> 엔티티는 디스크를 모르고,
     * 지우는 시점도 트랜잭션이 커밋된 뒤여야 합니다.
     */
    public void changeProfileImage(String profileImageUrl, OffsetDateTime updatedAt) {
        this.profileImageUrl = profileImageUrl;
        this.updatedAt = updatedAt;
    }

    public boolean hasNickname(String nickname) {
        return this.nickname.equals(nickname);
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getNickname() {
        return nickname;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
