import { useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { Logo } from './icons';

/** Shown after a password-reset link: the user is signed in but must choose a new password. */
export function NewPasswordScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setError('Choose a password of at least 8 characters.');
    setBusy(true);
    setError('');
    const out = await useStore.getState().updatePassword(password);
    if (!out.ok) setError(out.error);
    setBusy(false);
  };

  return (
    <main className="auth-page">
      <section className="card auth-card" aria-labelledby="newPasswordTitle">
        <span className="brand">
          <Logo />
          Road to Goals
        </span>
        <h1 id="newPasswordTitle">Choose a new password</h1>
        <form noValidate onSubmit={submit}>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary" type="submit" disabled={busy}>
            Save password
          </button>
        </form>
      </section>
    </main>
  );
}
