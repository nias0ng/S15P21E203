package com.hyanghae.backend.auth.dto.response;

public record SignupResponse(Long userId, String email, String nickname) {
}
