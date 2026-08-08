// Seeds a few sample categories and items for local testing, scoped to the
// signed-in account (users/{uid}/...).
// Usage: node scripts/seed.mjs <email> <password>
// The account must already exist (sign up in the app first) and Firestore
// rules must allow authenticated reads/writes (see firestore.rules).
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

config({ path: '.env.local' });
config();

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node scripts/seed.mjs <email> <password>');
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
const db = getFirestore(app);

const categories = [
  { id: 'breakfast', name: 'Breakfast', order: 0 },
  { id: 'lunch', name: 'Lunch', order: 1 },
  { id: 'raw', name: 'Raw', order: 2 },
  { id: 'prep', name: 'Prep', order: 3 },
];

const items = [
  { id: 'filet', name: 'Filet', color: '#007aff', categoryId: 'lunch', imageUrl: '', price: 3.29, order: 0 },
  { id: 'spicy', name: 'Spicy', color: '#ff3b30', categoryId: 'lunch', imageUrl: '', price: 3.29, order: 1 },
  { id: 'nuggets', name: 'Nuggets', color: '#ff2d92', categoryId: 'lunch', imageUrl: '', price: 0.5, order: 2 },
  { id: 'strips', name: 'Strips', color: '#34c759', categoryId: 'lunch', imageUrl: '', price: 1.25, order: 3 },
  { id: 'bun', name: 'Bun', color: '#c69214', categoryId: 'prep', imageUrl: '', price: 0.35, order: 0 },
  { id: 'mac-cheese', name: 'Mac & Cheese', color: '#ffcc00', categoryId: 'lunch', imageUrl: '', price: 1.99, order: 4 },
];

async function main() {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  for (const category of categories) {
    const { id, ...data } = category;
    await setDoc(doc(db, 'users', uid, 'categories', id), data);
  }
  for (const item of items) {
    const { id, ...data } = item;
    await setDoc(doc(db, 'users', uid, 'items', id), { ...data, active: true });
  }

  console.log(`Seeded ${categories.length} categories and ${items.length} items.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
