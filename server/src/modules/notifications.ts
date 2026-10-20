import { Router } from 'express';
import { insert, where, getById, updateById, col, now, sortBy } from '../db/firestore.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const rows = sortBy(await where('notifications', 'user_id', req.user!.id), 'created_at', 'desc').slice(0, 50);
  res.json({ notifications: rows });
});

notificationsRouter.post('/read', async (req, res) => {
  const rows = await where('notifications', 'user_id', req.user!.id);
  await Promise.all(rows.filter(n => !n.read).map(n => col('notifications').doc(String(n.id)).update({ read: true })));
  res.json({ ok: true });
});

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get('/:projectId/tasks', requireProjectAccess(), async (req, res) => {
  const rows = sortBy(await where('tasks', 'project_id', Number(req.params.projectId)), 'created_at', 'desc');
  res.json({ tasks: [...rows.filter(t => t.status === 'open'), ...rows.filter(t => t.status !== 'open')] });
});

tasksRouter.post('/:projectId/tasks', requireProjectAccess(), async (req, res) => {
  const { title, description, waiting_on = 'applicant', project_approval_id, verified_due_date } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const task = await insert('tasks', {
    project_id: Number(req.params.projectId),
    project_approval_id: project_approval_id ? Number(project_approval_id) : null,
    title, description: description || null, waiting_on,
    assignee_user_id: null, verified_due_date: verified_due_date || null,
    status: 'open', created_at: now(), completed_at: null,
  });
  res.status(201).json({ task });
});

tasksRouter.patch('/:projectId/tasks/:taskId', requireProjectAccess(), async (req, res) => {
  const { status } = req.body || {};
  if (!['open','done','cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const t = await getById('tasks', req.params.taskId);
  if (!t || t.project_id !== Number(req.params.projectId)) return res.status(404).json({ error: 'Not found' });
  res.json({ task: await updateById('tasks', t.id, { status, completed_at: status === 'done' ? now() : null }) });
});
