import type { Provider, SupabaseClient, User } from '@supabase/supabase-js';
import {
  AuthError,
  type AuthProviderId,
  type AuthResult,
  type AuthService,
  type AuthUser,
  type LinkedMethod,
} from '../../auth/types';
import { toAuthError } from './errors';

/** App provider ids → Supabase provider names. Adding a provider starts here. */
const OAUTH: Record<Exclude<AuthProviderId, 'password'>, Provider> = {
  google: 'google',
  x: 'x', // Twitter / X OAuth 2.0
};
const FROM_SUPABASE: Record<string, AuthProviderId> = {
  google: 'google',
  x: 'x',
  email: 'password',
};

const toUser = (u: User | null | undefined): AuthUser | null =>
  u ? { id: u.id, email: u.email ?? null } : null;

/** Where OAuth and email links send the user back to: this page. */
const redirectUrl = () => `${window.location.origin}/`;

async function wrap<R extends { data: unknown; error: unknown }>(
  op: PromiseLike<R>,
): Promise<R['data']> {
  try {
    const { data, error } = await op;
    if (error) throw error;
    return data;
  } catch (e) {
    throw toAuthError(e);
  }
}

export function createSupabaseAuth(client: SupabaseClient): AuthService {
  const identities = async () => {
    const data = await wrap(client.auth.getUserIdentities());
    return data?.identities ?? [];
  };

  return {
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        // Supabase calls back while holding an internal lock, so defer anything slow.
        const user = toUser(session?.user);
        setTimeout(() => cb(user), 0);
      });
      return () => data.subscription.unsubscribe();
    },

    async signInWithProvider(provider) {
      await wrap(
        client.auth.signInWithOAuth({
          provider: OAUTH[provider],
          options: { redirectTo: redirectUrl() },
        }),
      );
      return 'redirecting';
    },

    async signInWithPassword(email, password) {
      await wrap(client.auth.signInWithPassword({ email, password }));
      return 'signedIn';
    },

    async signUpWithPassword(email, password) {
      const data = await wrap(
        client.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } }),
      );
      // With confirmation on, there is no session until the link is opened. A user object
      // with no identities means the email is already registered (Supabase hides that).
      if (data?.user && data.user.identities?.length === 0) {
        throw new AuthError('emailTaken', 'This email is already registered. Sign in instead.');
      }
      return data?.session ? 'signedIn' : 'confirmEmail';
    },

    async sendPasswordReset(email) {
      await wrap(client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() }));
    },

    async linkProvider(provider): Promise<AuthResult> {
      await wrap(
        client.auth.linkIdentity({
          provider: OAUTH[provider],
          options: { redirectTo: redirectUrl() },
        }),
      );
      return 'redirecting';
    },

    async linkPassword(email, password): Promise<AuthResult> {
      // Adds the email identity to this same user; Supabase emails a confirmation link.
      await wrap(client.auth.updateUser({ email, password }, { emailRedirectTo: redirectUrl() }));
      return 'confirmEmail';
    },

    async unlinkProvider(provider) {
      const all = await identities();
      if (all.length <= 1) throw new AuthError('lastMethod', 'This is your only sign-in method.');
      const target = all.find((i) => FROM_SUPABASE[i.provider] === provider);
      if (!target) return;
      await wrap(client.auth.unlinkIdentity(target));
    },

    async listMethods(): Promise<LinkedMethod[]> {
      return (await identities()).flatMap((i) => {
        const provider = FROM_SUPABASE[i.provider];
        const detail = (i.identity_data as { email?: string } | undefined)?.email ?? null;
        return provider ? [{ provider, detail }] : [];
      });
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw toAuthError(error);
    },
  };
}
