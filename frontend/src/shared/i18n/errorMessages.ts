/**
 * 서버 오류 코드의 영어 문구. 한국어 화면은 서버가 보낸 문구를 그대로 씁니다 — 한국어 표를
 * 여기에 또 두면 서버 문구와 따로 놀게 됩니다.
 *
 * 코드는 백엔드 `*ErrorCode` enum 이름과 `GlobalExceptionHandler` 의 공용 코드, 그리고
 * `shared/api/http` 가 붙이는 `SERVER_UNREACHABLE` 입니다. 여기 없는 코드는 부르는 쪽의
 * 대체 문구가 나갑니다.
 */
export const EN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  UNKNOWN: 'Something went wrong. Please try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again later.',
  SERVER_UNREACHABLE:
    "We can't reach the server right now. Please try again in a moment.",

  AUTH_EMAIL_ALREADY_EXISTS: 'This email is already in use.',
  AUTH_NICKNAME_ALREADY_EXISTS: 'This nickname is already taken.',
  AUTH_SIGNUP_CONFLICT: 'This email or nickname is already in use.',
  AUTH_INVALID_CREDENTIALS: 'Incorrect email or password.',
  AUTH_LOGIN_REQUIRED: 'Please log in first.',
  AUTH_INVALID_REFRESH_TOKEN: 'Your session has expired. Please log in again.',
  AUTH_ACCESS_DENIED: "You don't have permission to do that.",
  AUTH_USER_NOT_FOUND: "We couldn't find that account.",
  AUTH_CURRENT_PASSWORD_MISMATCH: 'Your current password is incorrect.',
  AUTH_INVALID_NICKNAME:
    'Nicknames must be 2–20 characters, not counting spaces.',
  AUTH_INVALID_EMAIL: 'Please enter a valid email address.',
  AUTH_EMAIL_NOT_VERIFIED: 'Please verify your email first.',
  AUTH_EMAIL_VERIFICATION_CODE_MISMATCH: 'That code is incorrect.',
  AUTH_EMAIL_VERIFICATION_EXPIRED:
    'Your code has expired. Please request a new one.',
  AUTH_EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS:
    'Too many incorrect attempts. Please request a new code.',
  AUTH_EMAIL_VERIFICATION_RESEND_TOO_SOON:
    'Please wait a moment before requesting another code.',
  AUTH_EMAIL_VERIFICATION_SEND_LIMIT_EXCEEDED:
    "You've requested too many codes. Please try again later.",
  AUTH_EMAIL_SEND_FAILED:
    "We couldn't send the verification email. Please try again later.",
  AUTH_PASSWORD_NOT_SET: "This account doesn't have a password.",
  AUTH_INVALID_GOOGLE_TOKEN: 'Your Google sign-in is no longer valid.',
  AUTH_GOOGLE_EMAIL_NOT_VERIFIED:
    'Only Google accounts with a verified email can be used.',
  AUTH_GOOGLE_ACCOUNT_MISMATCH:
    'Please confirm with the Google account you signed up with.',
  AUTH_GOOGLE_REAUTH_REQUIRED:
    'To delete your account, please confirm with Google once more.',
  AUTH_GOOGLE_LOGIN_FAILED:
    "We couldn't finish signing you in with Google. Please start over.",
  AUTH_GOOGLE_LOGIN_CANCELLED: 'Google sign-in was cancelled.',
  AUTH_EMAIL_REGISTERED_WITH_PASSWORD:
    'This email is already registered with a password. Please log in with your email and password.',
  AUTH_INVALID_GOOGLE_SIGNUP_TICKET:
    'Your sign-up session has expired. Please sign in with Google again.',
  AUTH_GOOGLE_LOGIN_UNAVAILABLE: 'Google sign-in is unavailable right now.',

  COLLECTION_LOGIN_REQUIRED: 'Please log in first.',
  COLLECTION_NOT_FOUND: "We couldn't find that collection.",
  COLLECTION_SHELF_ITEM_NOT_FOUND: "We couldn't find that item on your shelf.",
  COLLECTION_PERFUME_NOT_FOUND:
    "We couldn't find that perfume in the collection.",
  COLLECTION_NAME_ALREADY_EXISTS:
    'You already have a collection with this name.',
  COLLECTION_PERFUME_ALREADY_EXISTS:
    'This perfume is already in the collection.',
  COLLECTION_LAST_PERFUME: "You can't remove the last perfume in a collection.",
  COLLECTION_INVALID_REQUEST: 'Please check your collection details.',

  COMMUNITY_LOGIN_REQUIRED: 'Please log in first.',
  COMMUNITY_POST_NOT_FOUND: "We couldn't find that post.",
  COMMUNITY_POST_NOT_OWNED: 'You can only edit or delete your own posts.',
  COMMUNITY_CATEGORY_NOT_FOUND: "We couldn't find that board.",
  COMMUNITY_PERFUME_NOT_FOUND: "We couldn't find the perfume to attach.",
  COMMUNITY_POST_INVALID: 'Please check your post.',
  COMMUNITY_COMMENT_NOT_FOUND: "We couldn't find that comment.",
  COMMUNITY_COMMENT_NOT_OWNED: 'You can only edit or delete your own comments.',
  COMMUNITY_COLLECTION_NOT_FOUND: "We couldn't find the collection to attach.",
  COMMUNITY_PERFUMES_FROM_COLLECTION:
    'Posts with a collection take their perfumes from it. You can’t add perfumes separately.',
  COMMUNITY_IMAGE_EMPTY: 'Please choose an image to upload.',
  COMMUNITY_IMAGE_TOO_LARGE: 'This image is too large.',
  COMMUNITY_IMAGE_TYPE_NOT_ALLOWED:
    'Only JPG, PNG, GIF and WEBP images are allowed.',
  COMMUNITY_IMAGE_SAVE_FAILED: "We couldn't save the image.",

  MAP_PERFUME_NOT_FOUND: "We couldn't find that perfume on the map.",
  MAP_LOGIN_REQUIRED: 'Please log in first.',
  MAP_EXPLORATION_POINT_REQUIRED:
    'Please send either a perfume or a map position.',

  PERFUME_NOT_FOUND: "We couldn't find that perfume.",
  PERFUME_NOTE_NOT_FOUND: "We couldn't find that note.",
  PERFUME_BRAND_NOT_FOUND: "We couldn't find that brand.",

  PERFUME_VIEW_LOGIN_REQUIRED: 'Please log in first.',
  PERFUME_VIEW_NOT_FOUND: "We couldn't find that view record.",
  PERFUME_VIEW_SOURCE_NOT_FOUND: "We couldn't find the perfume you came from.",
  PERFUME_VIEW_INVALID_SOURCE:
    'Please check where you came from and the previous perfume.',

  RECOMMENDATION_LOGIN_REQUIRED: 'Please log in first.',
  RECOMMENDATION_TASTE_TEST_REQUIRED:
    'Take the taste test first to get personal recommendations.',
  RECOMMENDATION_NOT_FOUND: 'There are no perfumes to recommend right now.',
  RECOMMENDATION_REFRESH_IN_PROGRESS: "We're preparing your recommendations.",
  RECOMMENDATION_REFRESH_FAILED:
    "We can't prepare recommendations right now. Please try again shortly.",
  RECOMMENDATION_EXPOSURE_NOT_FOUND: "We couldn't find that recommendation.",
  RECOMMENDATION_AI_UNAVAILABLE:
    'Recommendations are unavailable right now. Please try again shortly.',
  RECOMMENDATION_RATE_LIMIT_EXCEEDED:
    "You're asking for recommendations too often. Please try again shortly.",
  RECOMMENDATION_RECORD_NOT_FOUND: "We couldn't find that recommendation.",
  RECOMMENDATION_FEEDBACK_ALREADY_ANSWERED:
    "You've already rated this recommendation.",

  REVIEW_LOGIN_REQUIRED: 'Please log in first.',
  REVIEW_NOT_FOUND: "We couldn't find that review.",
  REVIEW_ALREADY_EXISTS: "You've already reviewed this perfume.",
  REVIEW_SEASON_NOT_FOUND: "We couldn't find that season.",
  REVIEW_INVALID_SEASONS: 'Please check the seasons you selected.',

  SHELF_LAST_COLLECTION_ITEM:
    'This is the last perfume in a collection. Delete the collection first.',
  SHELF_LOGIN_REQUIRED: 'Please log in first.',
  SHELF_ITEM_NOT_FOUND: "We couldn't find that item on your shelf.",
  SHELF_PERFUME_NOT_FOUND: "We couldn't find the perfume to save.",
  SHELF_ITEM_ALREADY_EXISTS: 'This perfume is already on your shelf.',
  SHELF_MEMO_NOT_FOUND: "We couldn't find that note.",
  SHELF_MEMO_ALREADY_EXISTS: 'You already have a note for this perfume.',
  SHELF_INVALID_FIT_RATING:
    'Your match rating must be between 1.0 and 5.0, in steps of 0.5.',
  SHELF_REPRESENTATIVE_REQUIRES_OWNED:
    'Only perfumes you own can be your signature scent.',

  TASTE_LOGIN_REQUIRED: 'Please log in first.',
  TASTE_ALREADY_COMPLETED: "You've already taken the taste test.",
  TASTE_PICKS_REQUIRED: 'Please pick one or two scent families.',
  TASTE_PICKS_DUPLICATED: "You can't pick the same scent family twice.",
  TASTE_UNKNOWN_SCENT_REGION: "That scent family doesn't exist.",
  TASTE_PERFUME_NOT_ON_MAP: "That perfume isn't on the scent map.",
  TASTE_PERFUME_OUTSIDE_PRIMARY_REGION:
    "That perfume isn't in the area of your #1 scent family.",

  USER_PROFILE_IMAGE_EMPTY: 'Please choose an image to upload.',
  USER_PROFILE_IMAGE_TOO_LARGE: 'This image is too large.',
  USER_PROFILE_IMAGE_TYPE_NOT_ALLOWED:
    'Only JPG, PNG, GIF and WEBP images are allowed.',
  USER_PROFILE_IMAGE_SAVE_FAILED: "We couldn't save the image.",
}
