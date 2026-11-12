import { describeRepositoryContract } from '../../repositories/contract';
import { createMemoryBackend } from './memoryBackend';

describeRepositoryContract('memory backend', async () => {
  const backend = createMemoryBackend();
  await backend.auth.signUpWithPassword('a@example.test', 'password1');
  await backend.auth.signOut();
  await backend.auth.signUpWithPassword('b@example.test', 'password2');
  await backend.auth.signOut();
  return {
    repo: backend.repo,
    switchUser: async (who) => {
      await backend.auth.signOut();
      await backend.auth.signInWithPassword(
        who === 'a' ? 'a@example.test' : 'b@example.test',
        who === 'a' ? 'password1' : 'password2',
      );
    },
  };
});
