package com.hyanghae.backend.user.service;

import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.auth.service.AuthSessionStore;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.user.dto.request.PasswordChangeRequest;
import com.hyanghae.backend.user.dto.request.UserDeleteRequest;
import com.hyanghae.backend.user.dto.response.NicknameAvailabilityResponse;
import com.hyanghae.backend.user.dto.response.UserResponse;
import com.hyanghae.backend.user.entity.User;
import com.hyanghae.backend.user.repository.UserRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;
    private final AuthSessionStore sessionStore;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            CurrentUser currentUser,
            AuthSessionStore sessionStore
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.currentUser = currentUser;
        this.sessionStore = sessionStore;
    }

    @Transactional(readOnly = true)
    public NicknameAvailabilityResponse nicknameAvailability(String nickname) {
        String normalized = normalizeNickname(nickname);
        return new NicknameAvailabilityResponse(!userRepository.existsByNickname(normalized));
    }

    @Transactional(readOnly = true)
    public UserResponse findMe() {
        User user = findCurrentUser();
        return new UserResponse(user.getId(), user.getEmail(), user.getNickname());
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
        sessionStore.revokeAll(userId);
        userRepository.delete(user);
        userRepository.flush();
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
