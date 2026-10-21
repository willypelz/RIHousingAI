/** Firestore-backed file storage. Serverless hosts have ephemeral disks and Firebase
 *  Storage requires the Blaze plan, so uploaded documents are persisted as <1MiB
 *  base64 chunks in the `document_files` collection. Max file size: 10MB. */
import { db } from './firestore.js';

// 700KB of raw bytes → ~933KB base64, safely under Firestore's 1MiB document limit.
const CHUNK_BYTES = 700_000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function saveFile(key: string, buf: Buffer): Promise<void> {
  if (buf.length > MAX_FILE_BYTES) throw new Error('File exceeds the 10MB storage limit');
  const chunks: Buffer[] = [];
  for (let i = 0; i < buf.length; i += CHUNK_BYTES) chunks.push(buf.subarray(i, i + CHUNK_BYTES));
  const batch = db.batch();
  chunks.forEach((c, idx) => {
    batch.set(db.collection('document_files').doc(`${key}_${idx}`), {
      key, idx, total: chunks.length, data: c.toString('base64'),
    });
  });
  await batch.commit();
}

export async function readFile(key: string): Promise<Buffer | null> {
  const snap = await db.collection('document_files').where('key', '==', key).get();
  if (snap.empty) return null;
  const parts = snap.docs.map(d => d.data() as { idx: number; data: string }).sort((a, b) => a.idx - b.idx);
  return Buffer.concat(parts.map(p => Buffer.from(p.data, 'base64')));
}
