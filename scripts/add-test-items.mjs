// Adds a handful of extra items to the Lunch category for exercising
// drag-reorder with a fuller grid. Safe to delete afterward with
// cleanup-test-items.mjs.
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

config({ path: '.env.local' });

const [, , email, password] = process.argv;

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

const newItems = [
  { name: 'Test Nuggets', color: '#ff9500' },
  { name: 'Test Fries', color: '#34c759' },
  { name: 'Test Drink', color: '#5856d6' },
  { name: 'Test Shake', color: '#ff2d55' },
  { name: 'Test Salad', color: '#00c7be' },
  { name: 'Test Wrap', color: '#af52de' },
];

async function main() {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const itemsCol = collection(db, 'users', uid, 'items');

  const existingSnap = await getDocs(query(itemsCol, where('categoryId', '==', 'lunch')));
  let maxOrder = -1;
  existingSnap.forEach((d) => {
    const o = d.data().order;
    if (typeof o === 'number' && o > maxOrder) maxOrder = o;
  });

  for (const [i, item] of newItems.entries()) {
    await addDoc(itemsCol, {
      name: item.name,
      color: item.color,
      categoryId: 'lunch',
      imageUrl: '',
      price: 0,
      order: maxOrder + 1 + i,
      active: true,
    });
  }
  console.log(`Added ${newItems.length} test items to lunch.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
