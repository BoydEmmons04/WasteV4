import { useEffect, useState } from 'react';
import { App, View, Page, Block, Preloader } from 'framework7-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TemplatePickerPage from './pages/TemplatePickerPage';
import MainScreen from './pages/MainScreen';

const f7params = {
  name: 'CFA Waste',
  theme: 'ios' as const,
  navbar: {
    iosCenterTitle: false,
  },
};

export default function MyApp() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setCheckingAuth(false);
    });
    return unsubscribe;
  }, []);

  return (
    <App {...f7params}>
      <View main>
        {checkingAuth ? (
          <Page>
            <Block className="display-flex justify-content-center align-items-center" style={{ height: '100%' }}>
              <Preloader />
            </Block>
          </Page>
        ) : user ? (
          justRegistered ? (
            <TemplatePickerPage onDone={() => setJustRegistered(false)} />
          ) : (
            <MainScreen />
          )
        ) : authMode === 'login' ? (
          <LoginPage onSwitchToRegister={() => setAuthMode('register')} />
        ) : (
          <RegisterPage onSwitchToLogin={() => setAuthMode('login')} onRegistered={() => setJustRegistered(true)} />
        )}
      </View>
    </App>
  );
}
