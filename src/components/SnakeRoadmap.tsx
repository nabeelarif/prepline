import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Flag } from 'lucide-react';
import { TYPES } from '../domain/constants';
import { fmtHours } from '../domain/format';
import { MARKER_Y, snakeLayout, type RoadmapNode } from '../domain/roadmap';
import { ProgressRing } from './ProgressRing';

const STATE_TEXT: Record<RoadmapNode['state'], string> = {
  done: 'completed',
  active: 'in progress',
  upcoming: 'not started',
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Done: a check. In Progress: the number inside a ring of weighted progress. */
function Marker({ node, n }: { node: RoadmapNode; n: number }) {
  if (node.state === 'done') return <Check size={18} strokeWidth={3} />;
  if (node.state === 'active')
    return (
      <ProgressRing pct={node.pct} size={44} stroke={3} color="var(--accent)">
        <span className="step-num">{n}</span>
      </ProgressRing>
    );
  return <>{n}</>;
}

interface Props {
  nodes: RoadmapNode[];
  /** Index of the first node, for numbering. */
  start?: number;
  /** Draw the finish flag after the last node. */
  finish: boolean;
  selectedId: string | null;
  onPick(node: RoadmapNode): void;
}

/**
 * Steps on a winding path. Geometry comes from `snakeLayout()`; this component
 * only measures its width and draws. The DOM keeps the steps in reading order.
 */
export function SnakeRoadmap({ nodes, start = 0, finish, selectedId, onPick }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const layout = snakeLayout(nodes.length + (finish ? 1 : 0), width);
  const vertical = layout.cols === 1;
  const flag = finish ? layout.points[nodes.length] : undefined;

  return (
    <div
      ref={ref}
      className={`snake${vertical ? ' vertical' : ''}`}
      style={{ height: width ? layout.height : undefined }}
    >
      {width > 0 && (
        <>
          <svg className="snake-path" width={width} height={layout.height} aria-hidden="true">
            {layout.segments.map((d, i) => (
              <path key={i} d={d} className={nodes[i]?.state === 'done' ? 'seg done' : 'seg'} />
            ))}
          </svg>
          <ol className="steps">
            {nodes.map((node, i) => {
              const p = layout.points[i]!;
              const style = (
                vertical
                  ? { top: p.y - MARKER_Y }
                  : {
                      top: p.y - MARKER_Y,
                      left: p.x - layout.cellWidth / 2,
                      width: layout.cellWidth,
                    }
              ) as CSSProperties;
              const meta =
                node.kind === 'resource'
                  ? `${TYPES[node.type!]} · ${fmtHours(node.total)}`
                  : `${node.doneCount} / ${node.count} resources · ${fmtHours(node.total)}`;
              return (
                <li key={node.id || 'unorganized'} className="step" style={style}>
                  <button
                    type="button"
                    className={`step-btn is-${node.state}${node.next ? ' is-next' : ''}${node.id === selectedId ? ' is-selected' : ''}`}
                    style={
                      node.color
                        ? ({ '--ph': `var(--ph-${node.color})` } as CSSProperties)
                        : undefined
                    }
                    onClick={() => onPick(node)}
                    title={node.title}
                  >
                    <span className="step-dot" aria-hidden="true">
                      <span className="step-marker">
                        <Marker node={node} n={start + i + 1} />
                      </span>
                    </span>
                    <span className="step-text">
                      <span className="step-title">
                        {node.color && <i className="ph-dot" aria-hidden="true" />}
                        {node.title}
                      </span>
                      <span className="step-meta">{meta}</span>
                      {node.next && <span className="next-tag">Next up</span>}
                      {node.kind !== 'resource' && node.count > 0 && (
                        <span className="step-bar" aria-hidden="true">
                          <i style={{ width: `${node.pct}%` }} />
                        </span>
                      )}
                      <span className="sr-only">
                        , step {start + i + 1}, {STATE_TEXT[node.state]}, {node.pct}% done
                        {node.next && ', recommended next'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {flag && (
            <span
              className="finish-flag"
              style={{ top: flag.y - 14, left: flag.x - 14 }}
              title="Finish"
              aria-hidden="true"
            >
              <Flag size={22} />
            </span>
          )}
        </>
      )}
    </div>
  );
}
