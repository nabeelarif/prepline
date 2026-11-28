import {
  Bot,
  CalendarDays,
  CircleAlert,
  ClipboardPaste,
  Copy,
  Ellipsis,
  FileUp,
  Globe,
  Link2,
  Lock,
  Pencil,
  Plus,
  Share2,
  Target,
  Trash2,
} from 'lucide-react';
import { useEffect } from 'react';
import { fmtDate, todayISO } from '../domain/dates';
import { fmtHours, shareCounts } from '../domain/format';
import { metrics } from '../domain/metrics';
import { pace } from '../domain/pace';
import { planStatus } from '../domain/schedule';
import type { Visibility } from '../domain/share';
import { Link } from 'react-router-dom';
import { paths } from '../routes';
import { useStore } from '../state/store';
import { EmptyState } from './EmptyState';
import { exportMenuItems } from './exportMenu';
import { Menu } from './Menu';
import { daysLeftText, paceText } from './paceText';
import { ProgressRing } from './ProgressRing';

const VISIBILITY: Record<Visibility, { label: string; Icon: typeof Lock }> = {
  private: { label: 'Private', Icon: Lock },
  unlisted: { label: 'Shared', Icon: Link2 },
  public: { label: 'Public', Icon: Globe },
};

function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const { label, Icon } = VISIBILITY[visibility];
  return (
    <span className={`badge vis-${visibility}`}>
      <Icon size={13} aria-hidden="true" /> {label}
    </span>
  );
}

export function MyPlans() {
  const goals = useStore((s) => s.data.goals);
  const shared = useStore((s) => s.sharing.plans);
  const sharingStatus = useStore((s) => s.sharing.status);
  const { openOverlay, duplicateGoal, deleteGoal } = useStore.getState();
  const today = todayISO();
  const newPlan = () => openOverlay({ kind: 'goal', goalId: null });
  const importPlan = () => openOverlay({ kind: 'import' });
  const pastePlan = () => openOverlay({ kind: 'import', source: 'paste' });
  // Other people fork and star plans, so the counts are read again on each visit.
  useEffect(() => void useStore.getState().refreshSharing(), []);

  return (
    <>
      <header className="page-head">
        <h1>My Plans</h1>
        <div className="btn-row">
          <button className="btn primary" onClick={newPlan}>
            <Plus size={18} aria-hidden="true" /> New plan
          </button>
          <button className="btn" onClick={() => openOverlay({ kind: 'ai' })}>
            <Bot size={18} aria-hidden="true" /> Use my own AI
          </button>
          <button className="btn" onClick={pastePlan}>
            <ClipboardPaste size={18} aria-hidden="true" /> Paste plan
          </button>
          <button className="btn" onClick={importPlan}>
            <FileUp size={18} aria-hidden="true" /> Import plan
          </button>
        </div>
      </header>
      {sharingStatus === 'error' && goals.length > 0 && (
        <div className="banner warn" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>
            <strong>Sharing info couldn’t load.</strong> Private, shared and public labels are
            hidden until it does.
          </p>
          <button className="btn sm" onClick={() => void useStore.getState().refreshSharing()}>
            Retry
          </button>
        </div>
      )}
      {!goals.length ? (
        <section className="card">
          <EmptyState
            level={2}
            icon={<Target />}
            title="Start your preparation journey"
            action={
              <button className="btn primary" onClick={newPlan}>
                Create Your First Plan
              </button>
            }
          >
            Create your first plan and organize the resources you want to complete. Start it when
            you are ready.
          </EmptyState>
        </section>
      ) : (
        <ul className="plan-grid">
          {goals.map((g) => {
            const m = metrics(g.resources);
            const p = pace(g, m, today);
            const status = planStatus(g);
            const share = shared[g.id];
            return (
              <li key={g.id} className="card plan-card">
                <div className="plan-top">
                  <ProgressRing pct={m.pct} size={56} stroke={6} label={`${m.pct}% complete`}>
                    <strong className="small">{m.pct}%</strong>
                  </ProgressRing>
                  <div className="plan-title">
                    <h2>{g.name}</h2>
                    <div className="plan-badges">
                      {status !== 'not_started' && (
                        <span className={`status s-${status}`}>
                          {status === 'completed' ? 'Completed' : 'In progress'}
                        </span>
                      )}
                      {/* Until sharing has loaded, a public plan must not pass for private. */}
                      {sharingStatus === 'ready' && (
                        <VisibilityBadge visibility={share?.visibility ?? 'private'} />
                      )}
                    </div>
                  </div>
                  <Menu
                    label={`Actions for ${g.name}`}
                    triggerClass="icon-btn"
                    trigger={<Ellipsis size={18} />}
                    align="end"
                    items={[
                      {
                        label: 'Edit plan',
                        icon: <Pencil size={16} />,
                        onSelect: () => openOverlay({ kind: 'goal', goalId: g.id }),
                      },
                      {
                        label: 'Share…',
                        icon: <Share2 size={16} />,
                        onSelect: () => openOverlay({ kind: 'share', goalId: g.id }),
                      },
                      {
                        label: 'Duplicate plan',
                        icon: <Copy size={16} />,
                        onSelect: () => duplicateGoal(g.id),
                      },
                      'divider',
                      ...exportMenuItems(g, shared[g.id]),
                      'divider',
                      {
                        label: 'Delete plan',
                        icon: <Trash2 size={16} />,
                        danger: true,
                        confirm: 'Delete plan, phases and resources?',
                        onSelect: () => deleteGoal(g.id),
                      },
                    ]}
                  />
                </div>
                {g.description && <p className="plan-desc">{g.description}</p>}
                <dl className="plan-facts">
                  <div>
                    <dt>
                      <CalendarDays size={15} aria-hidden="true" /> Deadline
                    </dt>
                    <dd>
                      {!g.startDate
                        ? 'Not started'
                        : g.targetDate
                          ? `${fmtDate(g.targetDate, true)} · ${daysLeftText(today, g.targetDate)}`
                          : 'No deadline'}
                    </dd>
                  </div>
                  <div>
                    <dt>Resources</dt>
                    <dd>
                      {m.doneCount} / {m.count} completed
                    </dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>{fmtHours(m.remaining)}</dd>
                  </div>
                </dl>
                {share?.visibility === 'public' && (
                  <p className="muted small plan-counts">
                    {shareCounts(share.copyCount, share.favoriteCount)}
                  </p>
                )}
                <div className="plan-foot">
                  <span className={`pace pace-${p.kind}`}>
                    {/* The Completed badge already says what this pill would. */}
                    {status !== 'completed' && <span className="pill">{paceText(p, g).label}</span>}
                  </span>
                  {!g.startDate && (
                    <button
                      className="btn sm"
                      onClick={() => openOverlay({ kind: 'start', goalId: g.id })}
                    >
                      Start
                    </button>
                  )}
                  <Link className="btn sm primary" to={paths.plan(g.id)}>
                    Open plan
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
