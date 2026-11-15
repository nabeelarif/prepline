import { AuthError, type AuthErrorCode } from '../../auth/types';
import { RepositoryError, type RepositoryErrorCode } from '../../repositories/errors';

interface Failure {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

const isNetwork = (e: Failure) =>
  e.name === 'AuthRetryableFetchError' ||
  /failed to fetch|networkerror|load failed|network request failed/i.test(e.message ?? '');

/** Maps a PostgREST / fetch failure to a backend-independent `RepositoryError`. */
export function toRepositoryError(e: unknown): RepositoryError {
  if (e instanceof RepositoryError) return e;
  const f = (e ?? {}) as Failure;
  let code: RepositoryErrorCode = 'unknown';
  if (isNetwork(f)) code = 'network';
  else if (f.status === 401 || f.status === 403 || f.code === '42501' || f.code === 'PGRST301')
    code = 'unauthorized';
  else if (f.code === '23505' || f.code === '23503') code = 'conflict';
  else if (f.code === '23514' || f.code === '22P02' || f.code === '22007' || f.code === '23502')
    code = 'validation';
  else if (f.status === 404) code = 'notFound';
  return new RepositoryError(code, f.message ?? 'Request failed', { cause: e });
}

/** Maps a Supabase Auth failure to an `AuthError`. */
export function toAuthError(e: unknown): AuthError {
  if (e instanceof AuthError) return e;
  const f = (e ?? {}) as Failure;
  const msg = f.message ?? 'Authentication failed';
  let code: AuthErrorCode = 'unknown';
  if (isNetwork(f)) code = 'network';
  else if (f.code === 'invalid_credentials') code = 'invalidCredentials';
  else if (f.code === 'email_not_confirmed') code = 'emailNotConfirmed';
  else if (f.code === 'user_already_exists' || f.code === 'email_exists') code = 'emailTaken';
  else if (f.code === 'weak_password') code = 'weakPassword';
  else if (f.code === 'identity_already_exists') code = 'alreadyLinked';
  else if (f.code === 'single_identity_not_deletable') code = 'lastMethod';
  return new AuthError(code, msg, { cause: e });
}
