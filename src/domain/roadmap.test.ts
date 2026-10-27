import { goal, res, TODAY } from '../test/fixtures';
import { columnsFor, MARKER_Y, ROW_HEIGHT, roadmap, snakeLayout, STEP_HEIGHT } from './roadmap';
import type { Phase } from './types';

const phase = (id: string, name = id): Phase => ({ id, name, description: '', color: 'blue' });
const phases = [phase('p1', 'Basics'), phase('p2', 'Advanced')];

describe('roadmap', () => {
  it('has one step per resource in priority order in simple view, with states', () => {
    const g = goal([
      res({ id: 'a', done: true }),
      res({ id: 'b', startedAt: TODAY }),
      res({ id: 'c', doneMinutes: 5 }),
      res({ id: 'd', type: 'practice' }),
    ]);
    expect(roadmap(g, 'simple').map((n) => [n.id, n.kind, n.state, n.next])).toEqual([
      ['a', 'resource', 'done', false],
      ['b', 'resource', 'active', true],
      ['c', 'resource', 'active', false],
      ['d', 'resource', 'upcoming', false],
    ]);
    expect(roadmap(g, 'simple')[3]!.type).toBe('practice');
  });

  it('shows every In Progress step as active, and marks next up separately', () => {
    const g = goal([
      res({ id: 'a' }),
      res({ id: 'b', startedAt: TODAY }),
      res({ id: 'c', startedAt: TODAY, doneMinutes: 30 }),
    ]);
    const nodes = roadmap(g, 'simple');
    expect(nodes.filter((n) => n.state === 'active').map((n) => n.id)).toEqual(['b', 'c']);
    // Next up follows priority order, not status.
    expect(nodes.filter((n) => n.next).map((n) => n.id)).toEqual(['a']);
  });

  it('marks nothing as next when everything is done', () => {
    const g = goal([res({ id: 'a', done: true }), res({ id: 'b', done: true })]);
    expect(roadmap(g, 'simple').some((n) => n.next)).toBe(false);
  });

  it('lists phases in phase order, then unorganized resources', () => {
    const g = goal(
      [res({ id: 'x', phaseId: 'p2' }), res({ id: 'y' }), res({ id: 'z', phaseId: 'p1' })],
      { phases },
    );
    expect(roadmap(g, 'phases').map((n) => [n.id, n.kind, n.title, n.count])).toEqual([
      ['p1', 'phase', 'Basics', 1],
      ['p2', 'phase', 'Advanced', 1],
      ['', 'unorganized', 'Unorganized', 1],
    ]);
  });

  it('is empty in phases view without phases, and has no unorganized step when not needed', () => {
    expect(roadmap(goal([res({ id: 'a' })]), 'phases')).toEqual([]);
    const g = goal([res({ id: 'a', phaseId: 'p1' })], { phases });
    expect(roadmap(g, 'phases').map((n) => n.id)).toEqual(['p1', 'p2']);
  });

  it('weights phase progress by hours and skips empty phases when choosing next up', () => {
    const g = goal(
      [
        res({ id: 'a', minutes: 60, done: true, phaseId: 'p2' }),
        res({ id: 'b', minutes: 1200, doneMinutes: 300, phaseId: 'p2' }),
      ],
      { phases },
    );
    const [p1, p2] = roadmap(g, 'phases');
    expect(p1).toMatchObject({ count: 0, total: 0, pct: 0, state: 'upcoming', next: false });
    expect(p2).toMatchObject({ count: 2, doneCount: 1, total: 1260, done: 360, pct: 29 });
    expect(p2).toMatchObject({ state: 'active', next: true });
  });
});

describe('snakeLayout', () => {
  it('picks fewer columns on narrower roadmaps', () => {
    expect([1000, 800, 600, 400].map(columnsFor)).toEqual([5, 4, 3, 1]);
  });

  it('snakes: rows alternate direction and stack by row height', () => {
    const l = snakeLayout(7, 600); // 3 columns of 200px
    expect(l.cols).toBe(3);
    expect(l.points.map((p) => [p.x, p.y])).toEqual([
      [100, MARKER_Y],
      [300, MARKER_Y],
      [500, MARKER_Y],
      [500, MARKER_Y + ROW_HEIGHT],
      [300, MARKER_Y + ROW_HEIGHT],
      [100, MARKER_Y + ROW_HEIGHT],
      [100, MARKER_Y + 2 * ROW_HEIGHT],
    ]);
    expect(l.height).toBe(3 * ROW_HEIGHT);
  });

  it('joins neighbours with lines and row ends with U-turns that bulge outward', () => {
    const l = snakeLayout(7, 600);
    expect(l.segments).toHaveLength(6);
    expect(l.segments[0]).toBe(`M 100 ${MARKER_Y} L 300 ${MARKER_Y}`);
    // Row 1 ends on the right, so its turn bulges right of x=500; row 2 bulges left of x=100.
    const cx = (s: string) => Number(s.split(' ')[4]);
    expect(l.segments[2]).toMatch(/^M 500 22 C /);
    expect(cx(l.segments[2]!)).toBeGreaterThan(500);
    expect(cx(l.segments[5]!)).toBeLessThan(100);
  });

  it('becomes a vertical stepper on narrow widths', () => {
    const l = snakeLayout(3, 360);
    expect(l.cols).toBe(1);
    expect(l.points.map((p) => p.y)).toEqual([
      MARKER_Y,
      MARKER_Y + STEP_HEIGHT,
      MARKER_Y + 2 * STEP_HEIGHT,
    ]);
    expect(new Set(l.points.map((p) => p.x)).size).toBe(1);
    expect(l.segments).toHaveLength(2);
  });

  it('handles empty and single-step journeys', () => {
    expect(snakeLayout(0, 1000)).toMatchObject({ points: [], segments: [], height: 0 });
    expect(snakeLayout(1, 1000).segments).toEqual([]);
  });
});
