package com.hyanghae.backend.user.controller;

import com.hyanghae.backend.user.dto.request.NicknameChangeRequest;
import com.hyanghae.backend.user.dto.request.PasswordChangeRequest;
import com.hyanghae.backend.user.dto.request.UserDeleteRequest;
import com.hyanghae.backend.user.dto.response.NicknameAvailabilityResponse;
import com.hyanghae.backend.user.dto.response.UserProfileImageResponse;
import com.hyanghae.backend.user.dto.response.UserResponse;
import com.hyanghae.backend.user.service.UserProfileImageService;
import com.hyanghae.backend.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "사용자", description = "사용자 계정과 내 정보를 관리합니다.")
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;
    private final UserProfileImageService profileImageService;

    public UserController(UserService userService,
            UserProfileImageService profileImageService) {
        this.userService = userService;
        this.profileImageService = profileImageService;
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

    /**
     * 프로필 사진을 올리고 바로 내 계정에 붙입니다.
     *
     * <p>게시글 이미지와 달리 한 번에 끝납니다. 매달 사용자가 이미 있어 두 단계로 나눌 이유가
     * 없고, 나누면 올려 놓고 적용하지 않은 파일만 남습니다.
     *
     * <p>쓰던 사진이 있으면 그 파일은 지워집니다.
     */
    @Operation(
            summary = "프로필 사진 업로드",
            description = "올리는 즉시 내 계정에 적용되고 쓰던 사진은 지워집니다."
                    + " JPG · PNG · GIF · WEBP 만 받으며 형식은 파일 이름이 아니라 파일 내용으로"
                    + " 판별합니다. 기본 크기 제한은 1MB 입니다."
    )
    @ApiResponse(responseCode = "200", description = "업로드 성공")
    @ApiResponse(responseCode = "400", description = "파일을 보내지 않았거나 빈 파일")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "413", description = "크기 제한 초과")
    @ApiResponse(responseCode = "415", description = "허용하지 않는 형식")
    @PostMapping(value = "/me/profile-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserProfileImageResponse uploadProfileImage(
            @Parameter(description = "올릴 이미지 파일", required = true)
            @RequestParam("file") MultipartFile file
    ) {
        return new UserProfileImageResponse(profileImageService.upload(file));
    }

    /**
     * 프로필 사진을 내립니다. 화면은 다시 기본 아바타를 보여줍니다.
     *
     * <p>쓰던 사진이 없어도 오류가 아닙니다. 여러 번 눌러도 결과가 같습니다.
     */
    @Operation(
            summary = "프로필 사진 삭제",
            description = "기본 아바타로 되돌립니다. 사진이 없어도 성공합니다."
    )
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @DeleteMapping("/me/profile-image")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProfileImage() {
        profileImageService.remove();
    }
}
