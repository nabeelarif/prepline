import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { AUTH_PROVIDERS, type AuthProviderId, type LinkedMethod } from '../../auth/types';
import { useStore } from '../../state/store';
import { DIALOG_TITLE } from '../Overlay';

/**
 * The signed-in account: which sign-in methods are linked to it. Linking adds a method to
 * this same account, so the same plans open from any of them.
 */
export function AccountPanel() {
  const user = useStore((s) => s.auth.user);
  const pending = useStore((s) => s.sync.pending);
  const store = useStore.getState();
  const [methods, setMethods] = useState<LinkedMethod[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const refresh = () => store.listMethods().then(setMethods);
  useEffect(() => {
    void store.listMethods().then(setMethods);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linked = (p: AuthProviderId) => methods?.some((m) => m.provider === p) ?? false;

  const act = async (fn: () => ReturnType<typeof store.linkProvider>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const out = await fn();
    if (!out.ok) setError(out.error);
    else if (out.result === 'confirmEmail') {
      setNotice('Check your email and open the confirmation link to finish adding it.');
      setShowPw(false);
    }
    await refresh();
    setBusy(false);
  };

  return (
    <div>
      <h2 id={DIALOG_TITLE} className="sheet-title">
        <UserRound aria-hidden="true" />
        Account
      </h2>
      <p>
        Signed in as <strong>{user?.email ?? 'your account'}</strong>.
      </p>
      <h3>Sign-in methods</h3>
      <p className="muted">
        Add more methods to open the same plans from any of them. They all belong to this one
        account.
      </p>
      <ul className="method-list">
        {AUTH_PROVIDERS.map((p) => (
          <li key={p.id}>
            <span>
              {p.label}
              {linked(p.id) && <small className="muted"> · linked</small>}
            </span>
            {linked(p.id) ? (
              (methods?.length ?? 0) > 1 && (
                <button
                  className="btn sm"
                  disabled={busy}
                  onClick={() => act(() => store.unlinkProvider(p.id))}
                >
                  Remove
                </button>
              )
            ) : p.id === 'password' ? (
              <button className="btn sm" disabled={busy} onClick={() => setShowPw(true)}>
                Add
              </button>
            ) : (
              <button
                className="btn sm"
                disabled={busy}
                onClick={() => act(() => store.linkProvider(p.id as 'google' | 'x'))}
              >
                Link
              </button>
            )}
          </li>
        ))}
      </ul>
      {showPw && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => store.linkPassword(email.trim(), password));
          }}
        >
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            Add email &amp; password
          </button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="btn-row">
        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            const warn = pending > 0 ? 'Some changes are not saved yet and will be lost. ' : '';
            if (warn && !window.confirm(`${warn}Sign out anyway?`)) return;
            void act(() => store.signOut());
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
