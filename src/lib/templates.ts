import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

export interface PublishedTemplateMeta {
  uid: string;
  label: string;
  categoryCount: number;
  itemCount: number;
}

// Publishing snapshots the account's current categories and active items
// into a public, read-only copy other accounts can pull from at
// registration. It's a point-in-time copy, not a live link: editing your
// own items afterward doesn't change what's published until you publish
// again, which fully replaces the previous snapshot.
export async function publishTemplate(label: string) {
  const uid = requireUid();
  const categoriesCol = collection(db, 'users', uid, 'categories');
  const itemsCol = collection(db, 'users', uid, 'items');
  const templateCategoriesCol = collection(db, 'publishedTemplates', uid, 'categories');
  const templateItemsCol = collection(db, 'publishedTemplates', uid, 'items');

  const [categoriesSnap, itemsSnap, oldTemplateCategoriesSnap, oldTemplateItemsSnap] = await Promise.all([
    getDocs(categoriesCol),
    getDocs(itemsCol),
    getDocs(templateCategoriesCol),
    getDocs(templateItemsCol),
  ]);

  const activeItems = itemsSnap.docs.filter((d) => d.data().active !== false);

  const batch = writeBatch(db);
  oldTemplateCategoriesSnap.docs.forEach((d) => batch.delete(d.ref));
  oldTemplateItemsSnap.docs.forEach((d) => batch.delete(d.ref));

  batch.set(doc(db, 'publishedTemplates', uid), {
    label,
    publishedAt: serverTimestamp(),
    categoryCount: categoriesSnap.size,
    itemCount: activeItems.length,
  });
  categoriesSnap.docs.forEach((d) => {
    batch.set(doc(templateCategoriesCol, d.id), d.data());
  });
  activeItems.forEach((d) => {
    batch.set(doc(templateItemsCol, d.id), d.data());
  });

  await batch.commit();
}

export async function fetchPublishedTemplates(): Promise<PublishedTemplateMeta[]> {
  const snap = await getDocs(collection(db, 'publishedTemplates'));
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as Omit<PublishedTemplateMeta, 'uid'>) }))
    .filter((t) => t.itemCount > 0);
}

// Copies a published template's categories and items into the currently
// signed-in account (used right after registration). Category ids are
// regenerated so items can be re-linked to the copies rather than pointing
// back at the original template's category docs.
export async function copyTemplateIntoAccount(templateUid: string) {
  const uid = requireUid();
  const [templateCategoriesSnap, templateItemsSnap] = await Promise.all([
    getDocs(collection(db, 'publishedTemplates', templateUid, 'categories')),
    getDocs(collection(db, 'publishedTemplates', templateUid, 'items')),
  ]);

  const categoriesCol = collection(db, 'users', uid, 'categories');
  const itemsCol = collection(db, 'users', uid, 'items');

  const batch = writeBatch(db);
  const categoryIdMap = new Map<string, string>();

  templateCategoriesSnap.docs.forEach((d) => {
    const newRef = doc(categoriesCol);
    categoryIdMap.set(d.id, newRef.id);
    batch.set(newRef, d.data());
  });

  templateItemsSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown> & { categoryId: string };
    const newCategoryId = categoryIdMap.get(data.categoryId);
    if (!newCategoryId) return;
    batch.set(doc(itemsCol), { ...data, categoryId: newCategoryId, active: true });
  });

  await batch.commit();
}
