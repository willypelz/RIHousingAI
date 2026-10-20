/** Firestore data layer. Documents keep numeric `id` fields (doc key = String(id))
 *  so the existing REST API shapes and the frontend stay unchanged. */
import { initializeApp, cert, applicationDefault, getApps, type Credential } from 'firebase-admin/app';
import { getFirestore, type Transaction } from 'firebase-admin/firestore';
import fs from 'fs';

function credentials(): Credential {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) return cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8')));
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path && fs.existsSync(path)) return cert(JSON.parse(fs.readFileSync(path, 'utf8')));
  return applicationDefault();
}

if (!getApps().length) {
  initializeApp({ credential: credentials(), projectId: process.env.FIREBASE_PROJECT_ID || 'rihousingai-25382' });
}

export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

export const col = (name: string) => db.collection(name);

/** Mint sequential numeric IDs per collection (keeps API/frontend numeric-id contract). */
export async function nextId(collection: string): Promise<number> {
  const ref = db.collection('_counters').doc(collection);
  return db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) || 0) + 1;
    tx.set(ref, { value: next });
    return next;
  });
}

export async function insert(collection: string, data: Record<string, any>): Promise<any> {
  const id = await nextId(collection);
  const doc = { id, ...data };
  await col(collection).doc(String(id)).set(doc);
  return doc;
}

export async function getById<T = any>(collection: string, id: number | string): Promise<T | null> {
  const snap = await col(collection).doc(String(id)).get();
  return snap.exists ? (snap.data() as T) : null;
}

export async function updateById(collection: string, id: number | string, data: Record<string, any>): Promise<any | null> {
  const ref = col(collection).doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update(data);
  return { ...snap.data(), ...data };
}

/** Single-field equality query (no composite indexes needed); filter/sort further in JS. */
export async function where<T = any>(collection: string, field: string, value: any): Promise<T[]> {
  const snap = await col(collection).where(field, '==', value).get();
  return snap.docs.map((d: any) => d.data() as T);
}

export async function all<T = any>(collection: string): Promise<T[]> {
  const snap = await col(collection).get();
  return snap.docs.map((d: any) => d.data() as T);
}

export async function deleteWhere(collection: string, field: string, value: any): Promise<void> {
  const snap = await col(collection).where(field, '==', value).get();
  const batch = db.batch();
  snap.docs.forEach((d: any) => batch.delete(d.ref));
  await batch.commit();
}

export const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

export function sortBy<T>(rows: T[], key: keyof T, dir: 'asc' | 'desc' = 'asc'): T[] {
  return [...rows].sort((a: any, b: any) => {
    const av = a[key] ?? '', bv = b[key] ?? '';
    return (av < bv ? -1 : av > bv ? 1 : 0) * (dir === 'asc' ? 1 : -1);
  });
}

export function indexBy<T extends { id: number }>(rows: T[]): Record<number, T> {
  return Object.fromEntries(rows.map(r => [r.id, r]));
}
