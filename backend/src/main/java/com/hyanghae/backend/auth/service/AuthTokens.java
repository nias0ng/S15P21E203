package com.hyanghae.backend.auth.service;

public record AuthTokens(String accessToken, IssuedRefreshToken refreshToken) {
}
