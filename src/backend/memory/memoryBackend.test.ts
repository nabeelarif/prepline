import {
  describeRepositoryContract,
  describeSharingContract,
  type ContractSubject,
} from '../../repositories/contract';
import { createMemoryBackend } from './memoryBackend';

const make = async (): Promise<ContractSubject> => {
  const backend = createMemoryBackend();
  await backend.auth.signUpWithPassword('a@example.test', 'password1');
  await backend.auth.signOut();
  await backend.auth.signUpWithPassword('b@example.test', 'password2');
  await backend.auth.signOut();
  return {
    repo: backend.repo,
    sharing: backend.sharing,
    signOut: () => backend.auth.signOut(),
    switchUser: async (who) => {
      await backend.auth.signOut();
      await backend.auth.signInWithPassword(
        who === 'a' ? 'a@example.test' : 'b@example.test',
        who === 'a' ? 'password1' : 'password2',
      );
    },
  };
};

describeRepositoryContract('memory backend', make);
describeSharingContract('memory backend', make);
