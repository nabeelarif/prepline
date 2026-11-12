import { createClient } from '@supabase/supabase-js';
import { describeRepositoryContract } from '../../repositories/contract';
import { createSupabaseRepository } from './repository';

/**
 * Runs the repository contract against a real Supabase project with the schema applied.
 * Skipped unless these are set (use a throwaway project; the test deletes data):
 *   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY,
 *   SUPABASE_TEST_EMAIL_A / _PASSWORD_A, SUPABASE_TEST_EMAIL_B / _PASSWORD_B
 */
const env = process.env;
const configured =
  env.SUPABASE_TEST_URL &&
  env.SUPABASE_TEST_ANON_KEY &&
  env.SUPABASE_TEST_EMAIL_A &&
  env.SUPABASE_TEST_PASSWORD_A &&
  env.SUPABASE_TEST_EMAIL_B &&
  env.SUPABASE_TEST_PASSWORD_B;

if (configured) {
  describeRepositoryContract('Supabase', async () => {
    const client = createClient(env.SUPABASE_TEST_URL!, env.SUPABASE_TEST_ANON_KEY!, {
      auth: { persistSession: false },
    });
    return {
      repo: createSupabaseRepository(client),
      switchUser: async (who) => {
        await client.auth.signOut();
        const { error } = await client.auth.signInWithPassword({
          email: (who === 'a' ? env.SUPABASE_TEST_EMAIL_A : env.SUPABASE_TEST_EMAIL_B)!,
          password: (who === 'a' ? env.SUPABASE_TEST_PASSWORD_A : env.SUPABASE_TEST_PASSWORD_B)!,
        });
        if (error) throw error;
      },
    };
  });
} else {
  describe('Supabase live contract', () => {
    it.skip('needs SUPABASE_TEST_* environment variables (see docs/supabase-setup.md)', () => {});
  });
}
