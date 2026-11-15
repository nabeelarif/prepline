/** Backend-independent error categories. Implementations map their own errors onto these. */
export type RepositoryErrorCode =
  'network' | 'unauthorized' | 'notFound' | 'conflict' | 'validation' | 'unknown';

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  constructor(code: RepositoryErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

/** Text safe to show to a user. */
export function describeError(e: unknown): string {
  if (e instanceof RepositoryError) {
    switch (e.code) {
      case 'network':
        return 'Could not reach the server. Check your connection and try again.';
      case 'unauthorized':
        return 'Your session has expired. Sign in again.';
      case 'validation':
        return 'The server rejected this data.';
      case 'conflict':
        return 'This changed somewhere else, for example on another device.';
      default:
        return 'Something went wrong while talking to the server.';
    }
  }
  return 'Something went wrong.';
}
