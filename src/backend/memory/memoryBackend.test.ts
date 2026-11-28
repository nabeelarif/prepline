import {
  describeRepositoryContract,
  describeSharingContract,
  type ContractSubject,
} from '../../repositories/contract';
import { goal, res } from '../../test/fixtures';
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

// Only this backend can take a plan down from code; pgTAP covers the same rule in SQL.
describe('memory backend: takedown', () => {
  it('cannot be undone by making the plan private and sharing it again', async () => {
    const backend = createMemoryBackend();
    await backend.auth.signUpWithPassword('a@example.test', 'password1');
    await backend.repo.saveGoalTree(goal([res({ id: 'r' })], { id: 'g' }));
    const { slug } = await backend.sharing.setSharing('g', 'public', []);
    backend.takeDown(slug!);
    await backend.sharing.setSharing('g', 'private', []);
    expect(await backend.sharing.setSharing('g', 'public', [])).toMatchObject({ hidden: true });
    expect(await backend.sharing.listPublic()).toEqual([]);
  });
});
