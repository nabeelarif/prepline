import { AuthError } from './types';

/** Text safe to show a user for a failed sign-in step. */
export function describeAuthError(e: unknown): string {
  if (!(e instanceof AuthError)) return 'Something went wrong. Try again.';
  switch (e.code) {
    case 'invalidCredentials':
      return 'Incorrect email or password.';
    case 'emailNotConfirmed':
      return 'Confirm your email first: open the link we sent you, then sign in.';
    case 'emailTaken':
      return 'That email is already registered. Sign in instead, or reset your password.';
    case 'weakPassword':
      return 'Choose a stronger password (at least 8 characters).';
    case 'alreadyLinked':
      return 'That sign-in method already belongs to another account.';
    case 'lastMethod':
      return 'This is your only sign-in method, so it cannot be removed.';
    case 'network':
      return 'Could not reach the server. Check your connection and try again.';
    default:
      return e.message || 'Something went wrong. Try again.';
  }
}
