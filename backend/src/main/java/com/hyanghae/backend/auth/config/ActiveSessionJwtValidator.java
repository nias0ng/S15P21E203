package com.hyanghae.backend.auth.config;

import com.hyanghae.backend.auth.service.AuthSessionStore;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

public class ActiveSessionJwtValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error INVALID_SESSION = new OAuth2Error(
            "invalid_token",
            "The authentication session is no longer active",
            null
    );

    private final AuthSessionStore sessionStore;

    public ActiveSessionJwtValidator(AuthSessionStore sessionStore) {
        this.sessionStore = sessionStore;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        String sessionId = jwt.getClaimAsString("sid");
        Long userId;
        try {
            userId = Long.valueOf(jwt.getSubject());
        } catch (RuntimeException exception) {
            return OAuth2TokenValidatorResult.failure(INVALID_SESSION);
        }

        if (sessionId == null || !sessionStore.isActive(sessionId, userId)) {
            return OAuth2TokenValidatorResult.failure(INVALID_SESSION);
        }
        return OAuth2TokenValidatorResult.success();
    }
}
