// One-time setup: creates the dedicated admin Firebase Auth account. Its
// email must match ADMIN_LOGIN_EMAIL in src/lib/adminSession.ts and the
// isAdmin() check in firestore.rules - all three have to agree for admin
// login/access to work. Re-running this against an email that already
// exists will just fail harmlessly (Firebase rejects the duplicate).
// Usage: node scripts/create-admin.mjs <password>
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

config({ path: '.env.local' });
config();

const ADMIN_LOGIN_EMAIL = 'admin@cfawaste.internal';

const [, , password] = process.argv;
if (!password) {
  console.error('Usage: node scripts/create-admin.mjs <password>');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function main() {
  const cred = await createUserWithEmailAndPassword(auth, ADMIN_LOGIN_EMAIL, password);
  console.log(`Created admin account ${ADMIN_LOGIN_EMAIL} (uid: ${cred.user.uid}).`);
  console.log('Log in from the app with store code 00000 and this password.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err.code === 'auth/email-already-in-use' ? 'Admin account already exists - nothing to do.' : err);
  process.exit(1);
});
