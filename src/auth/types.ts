/** Sign-in methods. To add one: extend this union, `AUTH_PROVIDERS`, and the backend's auth. */
export type AuthProviderId = 'google' | 'x' | 'password';

export const AUTH_PROVIDERS: { id: AuthProviderId; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'x', label: 'X (Twitter)' },
  { id: 'password', label: 'Email & password' },
];

/** The stable internal user id: it does not change when sign-in methods are linked. */
export interface AuthUser {
  id: string;
  email: string | null;
}

export interface LinkedMethod {
  provider: AuthProviderId;
  /** E.g. the email of that identity. */
  detail: string | null;
}

export type AuthErrorCode =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'emailTaken'
  | 'weakPassword'
  | 'alreadyLinked'
  | 'lastMethod'
  | 'network'
  | 'unknown';

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** Outcome of a call that may need an email step (confirmation) or a redirect (OAuth). */
export type AuthResult = 'signedIn' | 'confirmEmail' | 'redirecting' | 'done';

/** Provider-neutral authentication. Implementations throw `AuthError`. */
export interface AuthService {
  /**
   * Calls back with the current user (or null) now and on every change. Returns an
   * unsubscribe function. May repeat the same user, e.g. on token refresh.
   */
  onChange(cb: (user: AuthUser | null) => void): () => void;
  /** OAuth providers redirect away; the result is `redirecting`. */
  signInWithProvider(provider: Exclude<AuthProviderId, 'password'>): Promise<AuthResult>;
  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  /** `confirmEmail` when the email must be confirmed before the first sign-in. */
  signUpWithPassword(email: string, password: string): Promise<AuthResult>;
  sendPasswordReset(email: string): Promise<void>;
  /**
   * Calls back when the user arrives from a password-reset link: they are signed in, and
   * the app must ask for a new password before anything else. Returns an unsubscribe.
   */
  onPasswordRecovery(cb: () => void): () => void;
  /** Sets a new password for the signed-in user. */
  updatePassword(password: string): Promise<void>;
  /** Attaches another method to the signed-in account (same user id, same data). */
  linkProvider(provider: Exclude<AuthProviderId, 'password'>): Promise<AuthResult>;
  /** Adds email & password to the signed-in account (may need email confirmation). */
  linkPassword(email: string, password: string): Promise<AuthResult>;
  unlinkProvider(provider: AuthProviderId): Promise<void>;
  listMethods(): Promise<LinkedMethod[]>;
  signOut(): Promise<void>;
}
