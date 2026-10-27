import type { AppData } from '../domain/types';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { createAppStore } from './store';

function memoryStorage(initial: unknown = null) {
  const saved: AppData[] = [];
  const adapter: StorageAdapter = {
    available: true,
    load: () => initial,
    save: (d) => {
      saved.push(d);
      return true;
    },
  };
  return { adapter, saved };
}

const empty = { version: 1, activeGoalId: null, goals: [] };

describe('store', () => {
  it('seeds the sample goal when nothing is saved', () => {
    const s = createAppStore(memoryStorage().adapter).getState();
    expect(s.data.goals).toHaveLength(1);
    expect(s.data.goals[0]!.sample).toBe(true);
  });

  it('persists every change through the adapter', () => {
    const { adapter, saved } = memoryStorage(empty);
    const store = createAppStore(adapter);
    store.getState().createGoal({ name: 'Prep', targetDate: '2026-05-01', hoursPerDay: 1 });
    store.getState().addResource({
      url: '',
      title: 'Read',
      type: 'article',
      minutes: 20,
      notes: '',
      sections: [],
    });
    expect(saved).toHaveLength(2);
    expect(saved[1]!.goals[0]!.resources[0]!.title).toBe('Read');
  });

  it('asks for a rating when a resource is finished, and clears it when rated', () => {
    const store = createAppStore(memoryStorage(empty).adapter);
    const s = () => store.getState();
    s().createGoal({ name: 'Prep', targetDate: '2026-05-01', hoursPerDay: 1 });
    s().addResource({ url: '', title: 'A', type: 'article', minutes: 20, notes: '', sections: [] });
    const id = s().data.goals[0]!.resources[0]!.id;

    s().toggleResource(id);
    expect(s().ui.ratingFor).toBe(id);
    s().rate(id, 4);
    expect(s().ui.ratingFor).toBeNull();
    expect(s().data.goals[0]!.resources[0]!.rating).toBe(4);
  });

  it('moves resources within bounds', () => {
    const store = createAppStore(memoryStorage(empty).adapter);
    const s = () => store.getState();
    s().createGoal({ name: 'Prep', targetDate: '2026-05-01', hoursPerDay: 1 });
    for (const title of ['A', 'B'])
      s().addResource({ url: '', title, type: 'article', minutes: 20, notes: '', sections: [] });
    const titles = () => s().data.goals[0]!.resources.map((r) => r.title);
    const [a] = s().data.goals[0]!.resources;
    s().moveResource(a!.id, -1);
    expect(titles()).toEqual(['A', 'B']);
    s().moveResource(a!.id, 1);
    expect(titles()).toEqual(['B', 'A']);
  });
});
