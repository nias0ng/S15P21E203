package com.hyanghae.backend.user.controller;

import com.hyanghae.backend.user.dto.request.NicknameChangeRequest;
import com.hyanghae.backend.user.dto.request.PasswordChangeRequest;
import com.hyanghae.backend.user.dto.request.UserDeleteRequest;
import com.hyanghae.backend.user.dto.response.EmailAvailabilityResponse;
import com.hyanghae.backend.user.dto.response.NicknameAvailabilityResponse;
import com.hyanghae.backend.user.dto.response.UserResponse;
import com.hyanghae.backend.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "사용자", description = "사용자 계정과 내 정보를 관리합니다.")
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * 가입에 쓸 수 있는 이메일인지 봅니다. 로그인이 필요 없습니다 — 가입 화면에서 씁니다.
     *
     * <p>참이어도 가입이 반드시 되는 것은 아닙니다. 확인과 가입 사이에 다른 사람이 같은
     * 이메일로 가입할 수 있어, 가입 시점에 한 번 더 걸러집니다.
     */
    @Operation(
            summary = "이메일 중복 확인",
            description = "가입에 쓸 수 있으면 available 이 참입니다. 가입과 같은 방식으로"
                    + " 앞뒤 공백을 떼고 소문자로 바꿔 봅니다. 참이어도 가입 시점에 다시"
                    + " 확인하므로 중복으로 실패할 수 있습니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "이메일 형식이 올바르지 않음")
    @GetMapping("/email-availability")
    public EmailAvailabilityResponse emailAvailability(
            @Parameter(description = "확인할 이메일", example = "sailor@example.com")
            @RequestParam
            String email
    ) {
        return userService.emailAvailability(email);
    }

    @Operation(summary = "닉네임 중복 확인")
    @ApiResponse(responseCode = "200", description = "확인 성공")
    @ApiResponse(responseCode = "400", description = "닉네임 형식 오류")
    @GetMapping("/nickname-availability")
    public NicknameAvailabilityResponse nicknameAvailability(
            @Parameter(description = "확인할 닉네임. 앞뒤 공백을 제거한 뒤 2~20자", example = "향해자")
            @RequestParam
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
            summary = "닉네임 변경",
            description = "지금 쓰고 있는 닉네임을 그대로 보내면 바꾸지 않고 성공합니다. "
                    + "로그인 세션은 유지됩니다."
    )
    @ApiResponse(responseCode = "200", description = "변경 성공")
    @ApiResponse(responseCode = "400", description = "닉네임 형식 오류")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "409", description = "이미 사용 중인 닉네임")
    @PatchMapping("/me/nickname")
    public UserResponse changeNickname(@Valid @RequestBody NicknameChangeRequest request) {
        return userService.changeNickname(request);
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
