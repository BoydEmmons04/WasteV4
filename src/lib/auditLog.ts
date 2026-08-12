import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface AuditLogEntry {
  id: string;
  action: string;
  detail: string;
  targetCode?: string;
  adminEmail: string;
  createdAt: Timestamp | null;
}

// Fire-and-forget from the caller's point of view: a logging failure should
// never block the real admin action it's describing, so this swallows its
// own errors rather than throwing.
export async function logAdminAction(action: string, detail: string, targetCode?: string): Promise<void> {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      action,
      detail,
      targetCode: targetCode ?? null,
      adminEmail: auth.currentUser?.email ?? 'unknown',
      createdAt: serverTimestamp(),
    });
  } catch {
    // Best-effort only - see comment above.
  }
}

export async function fetchAuditLog(limitCount = 200): Promise<AuditLogEntry[]> {
  const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      action: data.action as string,
      detail: data.detail as string,
      targetCode: typeof data.targetCode === 'string' ? data.targetCode : undefined,
      adminEmail: data.adminEmail as string,
      createdAt: (data.createdAt as Timestamp) ?? null,
    };
  });
}
