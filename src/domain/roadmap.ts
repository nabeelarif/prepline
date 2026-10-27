import { metrics } from './metrics';
import { resStatus } from './resources';
import type { Goal, PhaseColor, Resource, ResourceType } from './types';

export type RoadmapView = 'simple' | 'phases';
/** Completed, In Progress (any number of steps at once), or Not Started. */
export type StepState = 'done' | 'active' | 'upcoming';

/** One step of the journey: a resource (simple view) or a phase (phases view). */
export interface RoadmapNode {
  /** Resource id, phase id, or '' for resources in no phase. */
  id: string;
  kind: 'resource' | 'phase' | 'unorganized';
  title: string;
  /** Set on resource steps. */
  type?: ResourceType;
  /** Set on phase steps. */
  color?: PhaseColor;
  /** Minutes. */
  total: number;
  done: number;
  pct: number;
  doneCount: number;
  count: number;
  state: StepState;
  /** The recommended next step: the first unfinished one in priority order. */
  next: boolean;
}

/** Resources in a phase (null: in no phase), in priority order. */
export function phaseResources(g: Goal, phaseId: string | null): Resource[] {
  return g.resources.filter((r) => r.phaseId === phaseId);
}

/**
 * The journey in reading order. Simple view has one step per resource, in priority
 * order. Phases view has one step per phase, in phase order, then a group for
 * resources in no phase, if any. A step is active when any of its resources is In
 * Progress; separately, the first unfinished step is marked as next.
 */
export function roadmap(g: Goal, view: RoadmapView): RoadmapNode[] {
  const node = (
    id: string,
    kind: RoadmapNode['kind'],
    title: string,
    resources: Resource[],
    extra: Partial<RoadmapNode> = {},
  ): RoadmapNode => {
    // Progress comes from metrics(), so it is weighted by minutes everywhere.
    const m = metrics(resources);
    const complete = m.count > 0 && m.doneCount === m.count;
    const active = resources.some((r) => resStatus(r) === 'in_progress');
    return {
      id,
      kind,
      title,
      total: m.total,
      done: m.done,
      pct: m.pct,
      doneCount: m.doneCount,
      count: m.count,
      state: complete ? 'done' : active ? 'active' : 'upcoming',
      next: false,
      ...extra,
    };
  };

  let nodes: RoadmapNode[];
  if (view === 'simple') {
    nodes = g.resources.map((r) => node(r.id, 'resource', r.title, [r], { type: r.type }));
  } else if (!g.phases.length) {
    return [];
  } else {
    nodes = g.phases.map((p) =>
      node(p.id, 'phase', p.name, phaseResources(g, p.id), { color: p.color }),
    );
    const loose = phaseResources(g, null);
    if (loose.length) nodes.push(node('', 'unorganized', 'Unorganized', loose));
  }
  const next = nodes.find((n) => n.state !== 'done' && n.count > 0);
  if (next) next.next = true;
  return nodes;
}

export interface Point {
  x: number;
  y: number;
}

export interface SnakeLayout {
  /** Steps per row; 1 means a vertical stepper. */
  cols: number;
  cellWidth: number;
  height: number;
  /** Marker centres, in px from the top left of the roadmap. */
  points: Point[];
  /** SVG path data for the connector from point i to point i + 1. */
  segments: string[];
}

/** Height of one snake row, and of one stepper row. */
export const ROW_HEIGHT = 128;
export const STEP_HEIGHT = 76;
/** Marker centre from the top of its row. */
export const MARKER_Y = 22;
/** How far a U-turn may bulge past the outer marker's cell, into the card padding. */
const TURN_OVERHANG = 12;

export function columnsFor(width: number): number {
  return width >= 900 ? 5 : width >= 700 ? 4 : width >= 560 ? 3 : 1;
}

/**
 * Positions `n` markers on a snake: rows alternate direction and are joined by
 * U-turns at the edges. Narrow widths get a straight vertical stepper instead.
 */
export function snakeLayout(n: number, width: number): SnakeLayout {
  const cols = columnsFor(width);
  if (cols === 1) {
    const points = Array.from({ length: n }, (_, i) => ({
      x: MARKER_Y,
      y: i * STEP_HEIGHT + MARKER_Y,
    }));
    return {
      cols,
      cellWidth: width,
      height: n * STEP_HEIGHT,
      points,
      segments: points.slice(1).map((b, i) => line(points[i]!, b)),
    };
  }

  const cellWidth = width / cols;
  const points = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols);
    const k = i % cols;
    const col = row % 2 ? cols - 1 - k : k;
    return { x: (col + 0.5) * cellWidth, y: row * ROW_HEIGHT + MARKER_Y };
  });
  const segments = points.slice(1).map((b, i) => {
    const a = points[i]!;
    if (a.y === b.y) return line(a, b);
    // A cubic with both control points pushed sideways bulges by 3/4 of the push.
    const right = Math.floor(i / cols) % 2 === 0;
    const push = ((cellWidth / 2 + TURN_OVERHANG) * 4) / 3;
    const cx = a.x + (right ? push : -push);
    return `M ${r(a.x)} ${r(a.y)} C ${r(cx)} ${r(a.y)} ${r(cx)} ${r(b.y)} ${r(b.x)} ${r(b.y)}`;
  });
  const rows = Math.ceil(n / cols);
  return { cols, cellWidth, height: rows * ROW_HEIGHT, points, segments };
}

const r = (v: number) => Math.round(v * 10) / 10;
const line = (a: Point, b: Point) => `M ${r(a.x)} ${r(a.y)} L ${r(b.x)} ${r(b.y)}`;
