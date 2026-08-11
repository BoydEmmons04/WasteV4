import { useState } from 'react';
import { Page, Preloader } from 'framework7-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { codeToAuthPassword, lookupEmailByStoreCode } from '../lib/storeAuth';
import { ADMIN_LOGIN_EMAIL, RESERVED_ADMIN_CODE } from '../lib/adminSession';
import TrashUpIcon from '../components/TrashUpIcon';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

const CODE_PATTERN = /^\d{5}$/;

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 5);

export default function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const [code, setCode] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdminCode = code === RESERVED_ADMIN_CODE;

  const handleLogin = async () => {
    setError('');
    if (!CODE_PATTERN.test(code)) {
      setError('Enter your 5-digit store code.');
      return;
    }
    setLoading(true);
    try {
      if (isAdminCode) {
        // Firebase Auth itself validates the password server-side here -
        // it's never compared against anything in this codebase.
        await signInWithEmailAndPassword(auth, ADMIN_LOGIN_EMAIL, adminPassword);
        return;
      }
      const result = await lookupEmailByStoreCode(code);
      if (!result) {
        setError('Store code not found.');
        return;
      }
      await signInWithEmailAndPassword(auth, result.email, codeToAuthPassword(result.passwordCode));
    } catch {
      setError('Could not log in with that store code.');
    } finally {
      setLoading(false);
    }
  };

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
            <h1>Welcome back</h1>
            <p>Enter your store code to sign in</p>
          </div>

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div className="auth-field">
              <label htmlFor="login-code">Store Code</label>
              <input
                id="login-code"
                type="text"
                inputMode="numeric"
                placeholder="5 digits"
                maxLength={5}
                value={code}
                onChange={(e) => setCode(digitsOnly(e.target.value))}
                autoComplete="off"
                autoFocus
              />
            </div>

            {isAdminCode && (
              <div className="auth-field">
                <label htmlFor="login-admin-password">Admin Password</label>
                <input
                  id="login-admin-password"
                  type="password"
                  placeholder="Password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              className="auth-submit"
              disabled={loading || !CODE_PATTERN.test(code) || (isAdminCode && !adminPassword)}
            >
              {loading ? <Preloader color="white" /> : 'Log In'}
            </button>
          </form>

          <div className="auth-switch">
            Don't have an account? <a onClick={onSwitchToRegister}>Sign Up</a>
          </div>
        </div>
      </div>
    </Page>
  );
}
