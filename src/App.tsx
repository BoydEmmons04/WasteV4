import { useEffect, useState } from 'react';
import { App, View, Page, Block, Preloader } from 'framework7-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { ADMIN_LOGIN_EMAIL, setImpersonatedUid } from './lib/adminSession';
import { setupReconnectGuard } from './lib/reconnectGuard';
import { getStoredDarkMode } from './lib/theme';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TemplatePickerPage from './pages/TemplatePickerPage';
import MainScreen from './pages/MainScreen';
import AdminScreen from './pages/AdminScreen';

const f7params = {
  name: 'CFA Waste',
  theme: 'ios' as const,
  darkMode: getStoredDarkMode(),
  navbar: {
    iosCenterTitle: false,
  },
};

export default function MyApp() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [justRegistered, setJustRegistered] = useState(false);
  const [impersonatingUid, setImpersonatingUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setCheckingAuth(false);
      if (!u) {
        setImpersonatedUid(null);
        setImpersonatingUid(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setupReconnectGuard();
  }, []);

  // There's no server-side admin role available to this project (no
  // Cloud Functions / Admin SDK), so a fixed, known email - verified by
  // Firebase Auth's own sign-in call, never compared client-side - is the
  // actual identity check. firestore.rules' isAdmin() checks the same
  // email from the (signed, unforgeable) auth token for real data access;
  // this is only for deciding what to render.
  const isAdminUser = user?.email === ADMIN_LOGIN_EMAIL;

  const startViewingAccount = (uid: string) => {
    setImpersonatedUid(uid);
    setImpersonatingUid(uid);
  };

  const stopViewingAccount = () => {
    setImpersonatedUid(null);
    setImpersonatingUid(null);
  };

  return (
    <App {...f7params}>
      <View main>
        {checkingAuth ? (
          <Page>
            <Block className="display-flex justify-content-center align-items-center" style={{ height: '100%' }}>
              <Preloader />
            </Block>
          </Page>
        ) : user && isAdminUser ? (
          impersonatingUid ? (
            <MainScreen key={impersonatingUid} onExitImpersonation={stopViewingAccount} />
          ) : (
            <AdminScreen onViewAccount={startViewingAccount} />
          )
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
