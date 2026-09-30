package com.hyanghae.backend.auth.controller;

import com.hyanghae.backend.auth.dto.request.EmailVerificationConfirmRequest;
import com.hyanghae.backend.auth.dto.request.EmailVerificationRequest;
import com.hyanghae.backend.auth.dto.response.EmailVerificationConfirmResponse;
import com.hyanghae.backend.auth.dto.response.EmailVerificationResponse;
import com.hyanghae.backend.auth.service.EmailVerificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "인증")
@RestController
@RequestMapping("/api/v1/auth/email-verifications")
public class EmailVerificationController {

    private final EmailVerificationService emailVerificationService;

    public EmailVerificationController(EmailVerificationService emailVerificationService) {
        this.emailVerificationService = emailVerificationService;
    }

    @Operation(
            summary = "이메일 인증번호 보내기",
            description = "가입할 이메일로 숫자 7자리 인증번호를 보냅니다. 다시 보내면 이전 번호와 "
                    + "틀린 횟수는 사라집니다. 같은 이메일은 60초에 한 번, 1시간에 5번까지 보낼 수 있습니다."
    )
    @ApiResponse(responseCode = "200", description = "전송 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 이메일")
    @ApiResponse(responseCode = "409", description = "이미 가입된 이메일 (AUTH_EMAIL_ALREADY_EXISTS)")
    @ApiResponse(
            responseCode = "429",
            description = "재전송 대기 중 (AUTH_EMAIL_VERIFICATION_RESEND_TOO_SOON) 또는 "
                    + "시간당 전송 한도 초과 (AUTH_EMAIL_VERIFICATION_SEND_LIMIT_EXCEEDED)"
    )
    @ApiResponse(responseCode = "503", description = "메일 전송 실패 (AUTH_EMAIL_SEND_FAILED)")
    @PostMapping
    public EmailVerificationResponse send(@Valid @RequestBody EmailVerificationRequest request) {
        return emailVerificationService.send(request.email());
    }

    @Operation(
            summary = "이메일 인증번호 확인",
            description = "인증번호가 맞으면 회원가입에 쓰는 인증 토큰을 줍니다. 확인한 번호는 다시 쓸 수 "
                    + "없고, 5번 틀리면 번호가 사라져 다시 받아야 합니다."
    )
    @ApiResponse(responseCode = "200", description = "인증 성공")
    @ApiResponse(
            responseCode = "400",
            description = "올바르지 않은 요청, 인증번호 불일치 (AUTH_EMAIL_VERIFICATION_CODE_MISMATCH) "
                    + "또는 보낸 번호가 없거나 만료 (AUTH_EMAIL_VERIFICATION_EXPIRED)"
    )
    @ApiResponse(
            responseCode = "429",
            description = "틀린 횟수 초과로 번호 폐기 (AUTH_EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS)"
    )
    @PostMapping("/confirm")
    public EmailVerificationConfirmResponse confirm(
            @Valid @RequestBody EmailVerificationConfirmRequest request
    ) {
        return emailVerificationService.confirm(request.email(), request.code());
    }
}
