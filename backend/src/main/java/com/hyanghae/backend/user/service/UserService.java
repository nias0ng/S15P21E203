package com.hyanghae.backend.user.service;

import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.auth.service.AuthSessionStore;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.user.dto.request.NicknameChangeRequest;
import com.hyanghae.backend.user.dto.request.PasswordChangeRequest;
import com.hyanghae.backend.user.dto.request.UserDeleteRequest;
import com.hyanghae.backend.user.dto.response.NicknameAvailabilityResponse;
import com.hyanghae.backend.user.dto.response.UserResponse;
import com.hyanghae.backend.user.entity.User;
import com.hyanghae.backend.user.repository.UserRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;
    private final AuthSessionStore sessionStore;
    private final UserProfileImageService profileImageService;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            CurrentUser currentUser,
            AuthSessionStore sessionStore,
            UserProfileImageService profileImageService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.currentUser = currentUser;
        this.sessionStore = sessionStore;
        this.profileImageService = profileImageService;
    }

    @Transactional(readOnly = true)
    public NicknameAvailabilityResponse nicknameAvailability(String nickname) {
        String normalized = normalizeNickname(nickname);
        return new NicknameAvailabilityResponse(!userRepository.existsByNickname(normalized));
    }

    @Transactional(readOnly = true)
    public UserResponse findMe() {
        User user = findCurrentUser();
        return new UserResponse(user.getId(), user.getEmail(), user.getNickname(),
                user.getProfileImageUrl());
    }

    /**
     * 닉네임을 바꿉니다. 로그인 세션은 그대로 둡니다 — 자격 증명이 아닙니다.
     *
     * <p>지금 쓰고 있는 닉네임을 그대로 보내면 바꾸지 않고 성공입니다. 중복 검사를 그냥 거치면
     * 자기 닉네임에 걸려 409 가 나고, 화면에서 닉네임을 안 고친 채 저장을 누르면 실패합니다.
     */
    @Transactional
    public UserResponse changeNickname(NicknameChangeRequest request) {
        User user = findCurrentUser();
        String nickname = normalizeNickname(request.nickname());

        if (!user.hasNickname(nickname)) {
            if (userRepository.existsByNickname(nickname)) {
                throw new BusinessException(AuthErrorCode.AUTH_NICKNAME_ALREADY_EXISTS);
            }
            user.changeNickname(nickname, OffsetDateTime.now(ZoneOffset.UTC));
            flushNickname();
        }
        return new UserResponse(user.getId(), user.getEmail(), user.getNickname(),
                user.getProfileImageUrl());
    }

    /**
     * 중복 검사와 저장 사이에 다른 요청이 같은 닉네임을 먼저 쓸 수 있습니다.
     * {@code uk_users_nickname} 이 막아 주므로 그 실패를 같은 409 로 바꿉니다.
     */
    private void flushNickname() {
        try {
            userRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(AuthErrorCode.AUTH_NICKNAME_ALREADY_EXISTS);
        }
    }

    @Transactional
    public void changePassword(PasswordChangeRequest request) {
        User user = findCurrentUser();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException(AuthErrorCode.AUTH_CURRENT_PASSWORD_MISMATCH);
        }
        sessionStore.revokeAll(user.getId());
        user.changePassword(
                passwordEncoder.encode(request.newPassword()),
                OffsetDateTime.now(ZoneOffset.UTC)
        );
    }

    @Transactional
    public void deleteMe(UserDeleteRequest request) {
        User user = findCurrentUser();
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException(AuthErrorCode.AUTH_CURRENT_PASSWORD_MISMATCH);
        }
        Long userId = user.getId();
        String profileImageUrl = user.getProfileImageUrl();
        sessionStore.revokeAll(userId);
        userRepository.delete(user);
        userRepository.flush();
        // 회원이 사라지면 그 사진을 가리키는 곳이 없습니다. flush 뒤에 부르므로 행이 실제로
        // 지워진 것을 확인한 뒤에 파일을 지웁니다.
        profileImageService.removeAfterWithdrawal(profileImageUrl);
    }

    private User findCurrentUser() {
        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_LOGIN_REQUIRED));
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_USER_NOT_FOUND));
    }

    private String normalizeNickname(String nickname) {
        String normalized = nickname.trim();
        if (normalized.length() < 2 || normalized.length() > 20) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_NICKNAME);
        }
        return normalized;
    }
}
