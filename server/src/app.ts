import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authRouter } from './modules/auth.js';
import { projectsRouter, municipalitiesRouter } from './modules/projects.js';
import { pathwaysRouter } from './modules/pathways.js';
import { documentsRouter } from './modules/documents.js';
import { workflowRouter } from './modules/workflow.js';
import { reviewsRouter } from './modules/reviews.js';
import { sourcesRouter } from './modules/sources.js';
import { notificationsRouter, tasksRouter } from './modules/notifications.js';
import { completenessRouter } from './modules/completeness.js';
import { assistantRouter } from './modules/assistant.js';
import { reportsRouter } from './modules/reports.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/municipalities', municipalitiesRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects', pathwaysRouter);
  app.use('/api/projects', documentsRouter);
  app.use('/api/projects', workflowRouter);
  app.use('/api/projects', reviewsRouter);
  app.use('/api/projects', tasksRouter);
  app.use('/api/projects', completenessRouter);
  app.use('/api/projects', reportsRouter);
  app.use('/api/sources', sourcesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/assistant', assistantRouter);

  // Serve built frontend in production (single Cloud Run service)
  const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
