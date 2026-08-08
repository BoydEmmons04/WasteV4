import { useState } from 'react';
import { Page, Navbar, List, ListInput, Button, Block, BlockTitle, Preloader, Link } from 'framework7-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { codeToAuthPassword, lookupEmailByStoreCode } from '../lib/storeAuth';

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
    <Page>
      <Navbar title="Log In" />
      <BlockTitle large className="text-align-center margin-top-large">
        WasteAgain
      </BlockTitle>
      <List form strongIos outlineIos dividersIos insetIos>
        <ListInput
          label="Store Code"
          type="text"
          inputmode="numeric"
          placeholder="5 digits"
          maxlength={5}
          value={code}
          onInput={(e) => setCode(digitsOnly(e.target.value))}
          autocomplete="off"
        />
      </List>
      {error && (
        <Block className="text-align-center" style={{ color: 'var(--f7-color-red)' }}>
          {error}
        </Block>
      )}
      <Block>
        <Button large fill round disabled={loading || !CODE_PATTERN.test(code)} onClick={handleLogin}>
          {loading ? <Preloader color="white" /> : 'Log In'}
        </Button>
      </Block>
      <Block className="text-align-center">
        <Link onClick={onSwitchToRegister}>Don't have an account? Sign Up</Link>
      </Block>
    </Page>
  );
}
