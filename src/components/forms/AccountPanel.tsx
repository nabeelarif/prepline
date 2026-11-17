import { useEffect, useState, type FormEvent } from 'react';
import { UserRound } from 'lucide-react';
import { AUTH_PROVIDERS, type AuthProviderId, type LinkedMethod } from '../../auth/types';
import { MAX_DISPLAY_NAME } from '../../domain/share';
import { useStore } from '../../state/store';
import { useSignOut } from '../useSignOut';
import { DIALOG_TITLE } from '../Overlay';

/**
 * The signed-in account: which sign-in methods are linked to it. Linking adds a method to
 * this same account, so the same plans open from any of them.
 */
export function AccountPanel() {
  const user = useStore((s) => s.auth.user);
  const signOut = useSignOut();
  const store = useStore.getState();
  const [methods, setMethods] = useState<LinkedMethod[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const savedName = useStore((s) => s.sharing.displayName);
  const sharingReady = useStore((s) => s.sharing.status === 'ready');
  const [name, setName] = useState(savedName ?? '');
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  useEffect(() => setName(savedName ?? ''), [savedName]);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (nameBusy) return;
    if (!name.trim()) return setNameMsg({ ok: false, text: 'Enter a name.' });
    setNameBusy(true);
    const err = await store.saveDisplayName(name);
    setNameMsg(err ? { ok: false, text: err } : { ok: true, text: 'Name saved.' });
    setNameBusy(false);
  };

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
      <h3>Your name</h3>
      <form noValidate onSubmit={saveName}>
        <label className="field">
          <span>Display name</span>
          <input
            type="text"
            autoComplete="name"
            maxLength={MAX_DISPLAY_NAME}
            value={name}
            disabled={!sharingReady}
            onChange={(e) => {
              setName(e.target.value);
              setNameMsg(null);
            }}
          />
          <small className="muted">Shown as the author of your public plans.</small>
        </label>
        <button
          className="btn"
          type="submit"
          disabled={nameBusy || !sharingReady || name.trim() === (savedName ?? '')}
        >
          Save name
        </button>
        {nameMsg && (
          <p
            className={nameMsg.ok ? undefined : 'form-error'}
            role={nameMsg.ok ? 'status' : 'alert'}
          >
            {nameMsg.text}
          </p>
        )}
      </form>
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
          onClick={() => void act(async () => (await signOut()) ?? { ok: true, result: 'done' })}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
