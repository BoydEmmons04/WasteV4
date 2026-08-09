import { useState } from 'react';
import { Page, Preloader } from 'framework7-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { codeToAuthPassword, lookupEmailByStoreCode } from '../lib/storeAuth';
import TrashUpIcon from '../components/TrashUpIcon';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

const CODE_PATTERN = /^\d{5}$/;

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 5);

export default function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!CODE_PATTERN.test(code)) {
      setError('Enter your 5-digit store code.');
      return;
    }
    setLoading(true);
    try {
      const email = await lookupEmailByStoreCode(code);
      if (!email) {
        setError('Store code not found.');
        return;
      }
      await signInWithEmailAndPassword(auth, email, codeToAuthPassword(code));
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

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit" disabled={loading || !CODE_PATTERN.test(code)}>
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
