import { useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { AUTH_PROVIDERS } from '../auth/types';
import { useStore, type AuthOutcome } from '../state/store';
import { Logo } from './icons';

type Mode = 'signIn' | 'signUp' | 'reset';

/** Sign-in screen: every plan belongs to an account, so nothing else shows until signed in. */
export function AuthGate() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const store = useStore.getState();

  const run = async (action: () => Promise<AuthOutcome>, done?: (r: string) => void) => {
    if (busy) return;
    setBusy(true);
    setError('');
    const out = await action();
    // After an OAuth redirect starts, keep the buttons disabled while the browser leaves.
    if (!out.ok) setError(out.error);
    else if (out.result === 'confirmEmail') {
      setNotice(`We sent a confirmation link to ${email.trim()}. Open it, then sign in.`);
      setMode('signIn');
    } else done?.(out.result);
    if (!out.ok || out.result !== 'redirecting') setBusy(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return setError('Enter your email.');
    if (mode === 'reset') {
      return run(
        () => store.sendPasswordReset(addr),
        () => {
          setNotice('If that email has an account, a reset link is on its way.');
          setMode('signIn');
        },
      );
    }
    if (!password) return setError('Enter your password.');
    setNotice('');
    return run(() =>
      mode === 'signIn'
        ? store.signInWithPassword(addr, password)
        : store.signUpWithPassword(addr, password),
    );
  };

  return (
    <main className="auth-page">
      <section className="card auth-card" aria-labelledby="authTitle">
        <span className="brand">
          <Logo />
          Road to Goals
        </span>
        <h1 id="authTitle">
          {mode === 'signUp'
            ? 'Create your account'
            : mode === 'reset'
              ? 'Reset password'
              : 'Sign in'}
        </h1>
        <p className="muted">Your plans are saved to your account, on every device.</p>

        {notice && (
          <p className="auth-notice" role="status">
            <MailCheck size={18} aria-hidden="true" /> {notice}
          </p>
        )}

        {mode !== 'reset' && (
          <div className="auth-providers">
            {AUTH_PROVIDERS.filter((p) => p.id !== 'password').map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  run(() => store.signInWithProvider(p.id as Exclude<typeof p.id, 'password'>))
                }
              >
                Continue with {p.label}
              </button>
            ))}
            <p className="auth-or">or use email</p>
          </div>
        )}

        <form noValidate onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== 'reset' && (
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary" type="submit" disabled={busy}>
            {mode === 'signUp'
              ? 'Create account'
              : mode === 'reset'
                ? 'Send reset link'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signIn' ? (
            <>
              <button className="link-btn" onClick={() => setMode('signUp')}>
                Create an account
              </button>
              <button className="link-btn" onClick={() => setMode('reset')}>
                Forgot password?
              </button>
            </>
          ) : (
            <button className="link-btn" onClick={() => setMode('signIn')}>
              Back to sign in
            </button>
          )}
        </p>
      </section>
    </main>
  );
}
