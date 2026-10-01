import type { Messages } from '../../types'
import type { auth as ko } from '../ko/auth'

export const auth = {
  actions: {
    cancel: 'Cancel',
    save: 'Save',
    backToLogin: 'Log in →',
  },
  email: {
    label: 'Email',
    localLabel: 'Email username',
    domainLabel: 'Email domain',
    domainChoose: 'Choose',
    domainDirect: 'Other',
    customLabel: 'Enter a domain',
    customPlaceholder: 'Enter a domain (e.g. example.com)',
  },
  password: {
    label: 'Password',
    confirm: 'Confirm password',
    reenter: 'Re-enter password',
    newLabel: 'New password',
    newConfirm: 'Confirm new password',
    newReenter: 'Re-enter new password',
    current: 'Current password',
    tooShort: 'Password must be at least {{min}} characters',
    rule: 'Password must be at least {{min}} characters.',
    mismatch: "Passwords don't match",
  },
  nickname: {
    label: 'Nickname',
    lengthRule:
      'Nicknames must be {{min}}–{{max}} characters, not counting spaces',
    check: 'Check',
    checkPrompt: 'Press [Check] to see if it’s available',
    available: 'This nickname is available',
    taken: 'This nickname is already taken',
  },
  login: {
    title: 'Log in',
    passwordChanged:
      'Your password has been changed. Please log in with your new password.',
    signedUp: "You're signed up. Please log in.",
    failed: "We couldn't log you in. Please try again shortly.",
    submit: 'Log in',
    submitting: 'Logging in',
    toSignup: 'Sign up →',
    findPassword: 'Forgot password?',
  },
  signup: {
    title: 'Sign up',
    verified: 'Email verified',
    sendPrompt: 'Press [Verify] to get a code',
    send: 'Verify',
    codeLabel: 'Verification code',
    codePlaceholder: '{{length}}-digit code',
    codeSent: 'We sent you a code. Please check your inbox',
    timeLeft: 'Time left {{time}}',
    resend: 'Resend',
    confirm: 'Confirm',
    failed: "We couldn't sign you up. Please try again shortly.",
    submit: 'Sign up',
    submitting: 'Signing up',
  },
  verification: {
    emailTaken: 'This email is already in use.',
    sendFailed: "We couldn't send the code. Please try again shortly.",
    confirmFailed: "We couldn't check the code. Please try again shortly.",
    codeMismatch: 'That code is incorrect',
    codeExpired: 'Your code has expired. Press [Resend] to get a new one',
    tooManyAttempts:
      'Too many incorrect attempts. Press [Resend] to get a new code',
    timeUp: 'Time’s up. Press [Resend] to get a new code',
  },
  google: {
    or: 'or',
    loginButton: 'Sign in with Google',
    signupButton: 'Sign up with Google',
    finishTitle: 'Google sign-in',
    finishing: 'Signing you in…',
    errors: {
      registeredWithPassword:
        'This email is already registered with a password. Please log in with your email and password.',
      emailExists: 'This email is already registered.',
      emailNotVerified:
        'Only Google accounts with a verified email can be used.',
      cancelled: 'Google sign-in was cancelled.',
      unavailable: 'Google sign-in is unavailable right now.',
      accountMismatch:
        'Please confirm with the Google account you signed up with.',
      fallback:
        "We couldn't finish signing you in with Google. Please start over.",
    },
  },
  googleSignup: {
    title: 'Sign up with Google',
    loading: 'Loading…',
    description: 'Choose a nickname for Hyanghae to finish signing up.',
    ticketExpired:
      'Your sign-up session has expired. Please sign in with Google again.',
    ticketMissing:
      "We couldn't find your Google sign-in. Please sign in with Google again.",
  },
  passwordFind: {
    title: 'Forgot password',
    description: "We'll send a reset link to the email you signed up with",
    submit: 'Send link',
    sentTitle: 'Email sent',
    sentDescription: 'Use the link in your inbox to set a new password',
    sentBody:
      "We sent a reset link to {{email}}. If you don't see it, check your spam folder.",
    retry: 'Use a different email',
  },
  passwordReset: {
    title: 'Reset password',
    description: 'Choose a new password',
    submit: 'Change and log in',
  },
  passwordChange: {
    title: 'Change password',
    submit: 'Change',
    submitting: 'Changing',
    failed: "We couldn't change your password. Please try again shortly.",
  },
  account: {
    title: 'Account settings',
    emailFixed: "Your email can't be changed — it identifies your account",
    nicknameSaved: 'Nickname updated',
    nicknameSaveFailed: "We couldn't update your nickname",
    photoRemoved: 'Profile photo removed',
    photoChanged: 'Profile photo updated',
    section: 'Account',
    googleConnected: 'You log in with Google',
    changePassword: 'Change password',
    withdraw: 'Delete account',
  },
  profileImage: {
    fallback: 'Profile',
    alt: 'My profile photo',
    pick: 'Choose a profile photo',
    uploading: 'Uploading',
    change: 'Change photo',
    remove: 'Remove photo',
    sizeLimit: 'Up to 1MB',
    failed: "We couldn't update your profile photo. Please try again shortly.",
  },
  withdraw: {
    title: 'Delete account',
    submit: 'Delete',
    submitting: 'Deleting',
    noticeDeleted: 'Your shelf, collections and notes will be deleted.',
    noticePostsLead: 'Your posts, comments and reviews',
    noticePostsKept: 'will stay, with your name removed.',
    noticeFinal: 'Your account is deleted right away and can’t be restored.',
    agree: 'I understand',
    loading: 'Checking your account…',
    passwordHint: 'Enter it once more to confirm it’s you.',
    failed: "We couldn't delete your account. Please try again shortly.",
    googleUnavailable:
      "Google verification is unavailable right now, so your account can't be deleted.",
    googleConfirmed: 'Your Google account is confirmed.',
    googlePrompt:
      'To confirm it’s you, sign in once more with the Google account you signed up with.',
    googleButton: 'Continue with Google',
  },
} satisfies Messages<typeof ko>
