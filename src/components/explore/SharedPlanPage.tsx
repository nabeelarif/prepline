import { useEffect, useState, type CSSProperties } from 'react';
import { ExternalLink, Flag, Plus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TYPES } from '../../domain/constants';
import { fmtHours, pl } from '../../domain/format';
import type { SharedPlan, SharedResource } from '../../domain/share';
import { hostOf, safeUrl } from '../../domain/urls';
import { paths, rememberReturnPath } from '../../routes';
import { useStore } from '../../state/store';
import { EmptyState } from '../EmptyState';
import { TypeIcon } from '../icons';
import { useRequestSignIn } from './SignInContext';

type Result =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; plan: SharedPlan };

function Item({ r }: { r: SharedResource }) {
  const href = safeUrl(r.url);
  return (
    <li className="shared-item">
      <TypeIcon type={r.type} />
      <div className="shared-item-main">
        <p className="shared-item-title">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {r.title} <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : (
            r.title
          )}
        </p>
        <p className="muted">
          {TYPES[r.type]} · {fmtHours(r.minutes)}
          {href && ` · ${hostOf(href)}`}
        </p>
        {r.notes && <p className="shared-item-notes">{r.notes}</p>}
      </div>
    </li>
  );
}

/** One shared plan, read only. Nothing here can show progress: the plan has none. */
export function SharedPlanPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const signedIn = useStore((s) => s.auth.status === 'signedIn');
  const busy = useStore((s) => s.busy);
  const [result, setResult] = useState<Result>({ status: 'loading' });
  const [message, setMessage] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const requestSignIn = useRequestSignIn();

  useEffect(() => {
    let current = true;
    setResult({ status: 'loading' });
    useStore
      .getState()
      .fetchShared(slug)
      .then(
        (plan) => current && setResult(plan ? { status: 'ready', plan } : { status: 'missing' }),
      )
      .catch((e) => current && setResult({ status: 'error', message: (e as Error).message }));
    return () => {
      current = false;
    };
  }, [slug]);

  if (result.status === 'loading') return <p role="status">Loading plan…</p>;
  if (result.status === 'error') {
    return (
      <p className="msg err" role="alert">
        {result.message}
      </p>
    );
  }
  if (result.status === 'missing') {
    return (
      <section className="card welcome">
        <EmptyState
          level={1}
          icon={<Flag />}
          title="Plan not found"
          action={
            <Link className="btn primary" to={paths.explore}>
              Explore plans
            </Link>
          }
        >
          This link is wrong, or the owner stopped sharing the plan.
        </EmptyState>
      </section>
    );
  }

  const { plan } = result;
  const total = plan.resources.reduce((n, r) => n + r.minutes, 0);
  const inPhase = (id: string | null) => plan.resources.filter((r) => r.phaseId === id);
  const unassigned = plan.resources.filter(
    (r) => !r.phaseId || !plan.phases.some((p) => p.id === r.phaseId),
  );

  const add = async () => {
    if (!signedIn) {
      rememberReturnPath(paths.shared(plan.slug));
      requestSignIn();
      return;
    }
    setMessage('');
    const error = await useStore.getState().copySharedPlan(plan);
    if (error) setMessage(error);
    else navigate(paths.dashboard);
  };

  const report = async () => {
    const error = await useStore.getState().reportSharedPlan(plan.slug, reason);
    setMessage(error ?? 'Thank you. The plan was reported.');
    if (!error) setReporting(false);
  };

  return (
    <>
      <section className="card shared-head" aria-label="Plan overview">
        <p className="muted">
          <Link to={paths.explore}>Explore</Link> / Shared plan
        </p>
        <h1>{plan.name}</h1>
        {plan.author && <p className="muted">by {plan.author}</p>}
        {plan.description && <p className="plan-desc">{plan.description}</p>}
        {plan.tags.length > 0 && (
          <p className="explore-tags">
            {plan.tags.map((t) => (
              <span key={t} className="badge">
                {t}
              </span>
            ))}
          </p>
        )}
        <p className="muted">
          {pl(plan.resources.length, 'resource')} · {fmtHours(total)}
          {plan.phases.length > 0 && ` · ${pl(plan.phases.length, 'phase')}`}
        </p>
        <div className="btn-row">
          <button className="btn primary" onClick={add} disabled={busy}>
            <Plus size={18} aria-hidden="true" /> Add to My Plans
          </button>
          {signedIn && !reporting && (
            <button className="btn ghost" onClick={() => setReporting(true)}>
              <Flag size={16} aria-hidden="true" /> Report
            </button>
          )}
        </div>
        <p className="muted shared-note">
          Adding makes your own copy with no progress. Nothing you do changes this plan.
        </p>
        {reporting && (
          <div className="shared-report">
            <label className="field">
              <span>What is wrong with this plan?</span>
              <textarea
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="btn-row">
              <button className="btn" onClick={() => setReporting(false)}>
                Cancel
              </button>
              <button className="btn primary" disabled={!reason.trim()} onClick={report}>
                Send report
              </button>
            </div>
          </div>
        )}
        <p className="msg" role="status">
          {message}
        </p>
      </section>

      {plan.phases.map((p) => {
        const items = inPhase(p.id);
        if (!items.length) return null;
        return (
          <section
            key={p.id}
            className="card shared-phase"
            style={{ '--ph': `var(--ph-${p.color})` } as CSSProperties}
          >
            <h2>
              <i className="ph-dot" /> {p.name}
            </h2>
            {p.description && <p className="muted">{p.description}</p>}
            <ol className="shared-list">
              {items.map((r) => (
                <Item key={r.id} r={r} />
              ))}
            </ol>
          </section>
        );
      })}
      {unassigned.length > 0 && (
        <section className="card shared-phase">
          {plan.phases.length > 0 && <h2>Other resources</h2>}
          <ol className="shared-list">
            {unassigned.map((r) => (
              <Item key={r.id} r={r} />
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
