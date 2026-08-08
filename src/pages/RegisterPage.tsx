import { useState } from 'react';
import { Page, Navbar, List, ListInput, Button, Block, BlockTitle, Preloader, Link } from 'framework7-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { claimStoreCode, codeToAuthPassword, isStoreCodeTaken } from '../lib/storeAuth';

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

  return (
    <Page>
      <Navbar title="Sign Up" />
      <BlockTitle large className="text-align-center margin-top-large">
        WasteAgain
      </BlockTitle>
      <List form strongIos outlineIos dividersIos insetIos>
        <ListInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onInput={(e) => setEmail(e.target.value)}
          autocomplete="email"
        />
        <ListInput
          label="Store Code"
          type="text"
          inputmode="numeric"
          placeholder="5 digits"
          maxlength={5}
          value={code}
          onInput={(e) => setCode(digitsOnly(e.target.value))}
        />
        <ListInput
          label="Confirm Store Code"
          type="text"
          inputmode="numeric"
          placeholder="5 digits"
          maxlength={5}
          value={confirmCode}
          onInput={(e) => setConfirmCode(digitsOnly(e.target.value))}
        />
      </List>
      <Block className="text-align-center" style={{ fontSize: 13, opacity: 0.7 }}>
        Your store code is what you'll use to log in later, in place of a password - keep it somewhere you'll remember.
      </Block>
      {error && (
        <Block className="text-align-center" style={{ color: 'var(--f7-color-red)' }}>
          {error}
        </Block>
      )}
      <Block>
        <Button large fill round disabled={loading || !email || !code || !confirmCode} onClick={handleRegister}>
          {loading ? <Preloader color="white" /> : 'Create Account'}
        </Button>
      </Block>
      <Block className="text-align-center">
        <Link onClick={onSwitchToLogin}>Already have an account? Log In</Link>
      </Block>
    </Page>
  );
}
