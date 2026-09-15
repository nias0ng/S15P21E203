package com.hyanghae.backend.global.security;

import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class SecurityContextCurrentUser implements CurrentUser {

    @Override
    public Optional<Long> id() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.valueOf(authentication.getName()));
        } catch (NumberFormatException exception) {
            return Optional.empty();
        }
    }
}
