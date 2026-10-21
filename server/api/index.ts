/** Vercel serverless entrypoint: wraps the Express app as a single function.
 *  Seeding is idempotent and runs once per cold start. */
import { createApp } from '../src/app.js';
import { seed } from '../src/db/seed.js';

let ready: Promise<ReturnType<typeof createApp>> | null = null;

function getApp() {
  if (!ready) {
    ready = (async () => {
      try { await seed(); } catch (e) { console.error('Seed check failed:', (e as Error).message); }
      return createApp();
    })();
  }
  return ready;
}

export default async function handler(req: any, res: any) {
  const app = await getApp();
  app(req, res);
}
