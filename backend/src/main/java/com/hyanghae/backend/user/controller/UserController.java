package com.hyanghae.backend.user.controller;

import com.hyanghae.backend.user.dto.request.PasswordChangeRequest;
import com.hyanghae.backend.user.dto.request.UserDeleteRequest;
import com.hyanghae.backend.user.dto.response.NicknameAvailabilityResponse;
import com.hyanghae.backend.user.dto.response.UserResponse;
import com.hyanghae.backend.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "사용자", description = "사용자 계정과 내 정보를 관리합니다.")
@Validated
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "닉네임 중복 확인")
    @ApiResponse(responseCode = "200", description = "확인 성공")
    @ApiResponse(responseCode = "400", description = "닉네임 형식 오류")
    @GetMapping("/nickname-availability")
    public NicknameAvailabilityResponse nicknameAvailability(
            @Parameter(description = "확인할 닉네임", example = "향해자")
            @RequestParam
            @NotBlank
            @Size(min = 2, max = 20)
            String nickname
    ) {
        return userService.nicknameAvailability(nickname);
    }

    @Operation(summary = "내 정보 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @GetMapping("/me")
    public UserResponse findMe() {
        return userService.findMe();
    }

    @Operation(
            summary = "비밀번호 변경",
            description = "변경 후 모든 로그인 세션을 종료합니다."
    )
    @ApiResponse(responseCode = "204", description = "변경 성공")
    @ApiResponse(responseCode = "400", description = "현재 비밀번호 불일치 또는 새 비밀번호 형식 오류")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @PatchMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody PasswordChangeRequest request) {
        userService.changePassword(request);
    }

    @Operation(
            summary = "회원 탈퇴",
            description = "비밀번호 확인 후 계정을 삭제하고 모든 로그인 세션을 종료합니다."
    )
    @ApiResponse(responseCode = "204", description = "탈퇴 성공")
    @ApiResponse(responseCode = "400", description = "비밀번호 불일치")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@Valid @RequestBody UserDeleteRequest request) {
        userService.deleteMe(request);
    }
}
