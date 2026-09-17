package com.hyanghae.backend.user.service;

import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.auth.service.AuthSessionStore;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.user.dto.request.NicknameChangeRequest;
import com.hyanghae.backend.user.dto.request.PasswordChangeRequest;
import com.hyanghae.backend.user.dto.request.UserDeleteRequest;
import com.hyanghae.backend.user.dto.response.EmailAvailabilityResponse;
import com.hyanghae.backend.user.dto.response.NicknameAvailabilityResponse;
import com.hyanghae.backend.user.dto.response.UserResponse;
import com.hyanghae.backend.user.entity.User;
import com.hyanghae.backend.user.repository.UserRepository;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.regex.Pattern;
import java.time.ZoneOffset;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    /**
     * 이메일 형식입니다. 가입의 {@code @Email} 과 같은 수준으로 봅니다 — 주소가 실제로
     * 있는지는 확인하지 않고, 모양만 봅니다.
     */
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

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

    /**
     * 가입에 쓸 수 있는 이메일인지 봅니다.
     *
     * <p>가입 버튼을 눌러야 중복을 아는 것보다, 입력하는 중에 알려주는 편이 낫습니다. 닉네임에
     * 이미 같은 확인이 있습니다.
     *
     * <p>가입과 같은 방식으로 다듬어 봅니다 — 앞뒤 공백을 떼고 소문자로 바꿉니다. 그러지 않으면
     * 여기서는 쓸 수 있다고 했는데 가입에서 막히는 일이 생깁니다.
     *
     * <p><b>여기서 참이어도 가입이 반드시 되는 것은 아닙니다.</b> 확인과 가입 사이에 다른
     * 사람이 같은 이메일로 가입할 수 있어, 가입 시점에 한 번 더 걸러집니다.
     */
    @Transactional(readOnly = true)
    public EmailAvailabilityResponse emailAvailability(String email) {
        String normalized = normalizeEmail(email);
        return new EmailAvailabilityResponse(!userRepository.existsByEmail(normalized));
    }

    @Transactional(readOnly = true)
    public UserResponse findMe() {
        User user = findCurrentUser();
        return new UserResponse(user.getId(), user.getEmail(), user.getNickname());
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
        return new UserResponse(user.getId(), user.getEmail(), user.getNickname());
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

    /**
     * 가입({@code SignupRequest})과 같은 방식으로 다듬고, 형식을 봅니다.
     *
     * <p>형식 검사를 하는 이유는 오타에 "쓸 수 있습니다"라고 답하지 않기 위해서입니다. 가입은
     * {@code @Email} 이 걸러 주는데, 여기는 단순 조회라 걸러 주는 것이 없습니다.
     */
    private String normalizeEmail(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(normalized).matches() || normalized.length() > 255) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_EMAIL);
        }
        return normalized;
    }

    private String normalizeNickname(String nickname) {
        String normalized = nickname.trim();
        if (normalized.length() < 2 || normalized.length() > 20) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_NICKNAME);
        }
        return normalized;
    }
}
