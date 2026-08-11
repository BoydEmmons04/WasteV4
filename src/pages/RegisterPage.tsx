import { useState } from 'react';
import { Page, Preloader } from 'framework7-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { claimStoreCode, codeToAuthPassword, isStoreCodeTaken } from '../lib/storeAuth';
import { RESERVED_ADMIN_CODE } from '../lib/adminSession';
import TrashUpIcon from '../components/TrashUpIcon';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
  onRegistered: () => void;
}

const CODE_PATTERN = /^\d{5}$/;

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 5);

export default function RegisterPage({ onSwitchToLogin, onRegistered }: RegisterPageProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    if (!CODE_PATTERN.test(code)) {
      setError('Store code must be exactly 5 digits.');
      return;
    }
    if (code !== confirmCode) {
      setError('Store codes do not match.');
      return;
    }
    if (code === RESERVED_ADMIN_CODE) {
      setError('That store code is reserved. Choose a different one.');
      return;
    }
    setLoading(true);
    try {
      if (await isStoreCodeTaken(code)) {
        setError('That store code is already taken. Try another.');
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, email, codeToAuthPassword(code));
      try {
        await claimStoreCode(code, email, cred.user.uid);
      } catch {
        setError('That store code was just taken by someone else. Sign in and try a different one.');
        return;
      }
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && !!email && CODE_PATTERN.test(code) && CODE_PATTERN.test(confirmCode);

  return (
    <Page className="auth-page">
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-logo">
              <TrashUpIcon size={28} />
            </div>
            <div className="auth-brand-name">CFA Waste</div>
          </div>

          <div className="auth-heading">
            <h1>Create your store</h1>
            <p>Set up a store code to get started</p>
          </div>

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleRegister();
            }}
          >
            <div className="auth-field">
              <label htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="auth-field-code-row">
              <div className="auth-field">
                <label htmlFor="register-code">Store Code</label>
                <input
                  id="register-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="5 digits"
                  maxLength={5}
                  value={code}
                  onChange={(e) => setCode(digitsOnly(e.target.value))}
                  autoComplete="off"
                />
              </div>

              <div className="auth-field">
                <label htmlFor="register-confirm-code">Confirm Code</label>
                <input
                  id="register-confirm-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="5 digits"
                  maxLength={5}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(digitsOnly(e.target.value))}
                  autoComplete="off"
                />
              </div>
            </div>

            <p className="auth-hint">
              Your store code is what you'll use to log in later, in place of a password - keep it somewhere you'll remember.
            </p>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit" disabled={!canSubmit}>
              {loading ? <Preloader color="white" /> : 'Create Account'}
            </button>
          </form>

          <div className="auth-switch">
            Already have an account? <a onClick={onSwitchToLogin}>Log In</a>
          </div>
        </div>
      </div>
    </Page>
  );
}
