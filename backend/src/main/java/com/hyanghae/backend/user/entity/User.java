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

    /**
     * 비밀번호 해시입니다. Google 로 가입한 사람은 {@code null} 입니다.
     */
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    /**
     * Google ID 토큰의 {@code sub} 입니다. Google 로 가입하지 않았으면 {@code null} 입니다.
     */
    @Column(name = "google_subject", length = 255)
    private String googleSubject;

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
            String googleSubject,
            String nickname,
            OffsetDateTime createdAt
    ) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.googleSubject = googleSubject;
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
        return new User(email, passwordHash, null, nickname, createdAt);
    }

    public static User signupWithGoogle(
            String email,
            String googleSubject,
            String nickname,
            OffsetDateTime createdAt
    ) {
        return new User(email, null, googleSubject, nickname, createdAt);
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

    public boolean hasPassword() {
        return passwordHash != null;
    }

    public boolean hasGoogleSubject(String googleSubject) {
        return this.googleSubject != null && this.googleSubject.equals(googleSubject);
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

    public String getGoogleSubject() {
        return googleSubject;
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
