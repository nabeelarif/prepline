import { toRepositoryError } from './errors';

/** Awaits a Supabase call; throws a `RepositoryError` for a thrown or returned error. */
export async function call<T>(
  op: PromiseLike<{ data: T; error: unknown; status?: number }>,
): Promise<T> {
  let res;
  try {
    res = await op;
  } catch (e) {
    throw toRepositoryError(e);
  }
  if (res.error) throw toRepositoryError({ ...(res.error as object), status: res.status });
  return res.data;
}
