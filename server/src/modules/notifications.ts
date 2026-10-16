import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user!.id]);
  res.json({ notifications: rows });
});

notificationsRouter.post('/read', async (req, res) => {
  await query(`UPDATE notifications SET read=true WHERE user_id=$1`, [req.user!.id]);
  res.json({ ok: true });
});

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get('/:projectId/tasks', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(`SELECT * FROM tasks WHERE project_id=$1 ORDER BY status, created_at DESC`, [req.params.projectId]);
  res.json({ tasks: rows });
});

tasksRouter.post('/:projectId/tasks', requireProjectAccess(), async (req, res) => {
  const { title, description, waiting_on = 'applicant', project_approval_id, verified_due_date } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const { rows } = await query(
    `INSERT INTO tasks (project_id, project_approval_id, title, description, waiting_on, verified_due_date)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.projectId, project_approval_id || null, title, description || null, waiting_on, verified_due_date || null]);
  res.status(201).json({ task: rows[0] });
});

tasksRouter.patch('/:projectId/tasks/:taskId', requireProjectAccess(), async (req, res) => {
  const { status } = req.body || {};
  if (!['open','done','cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await query(
    `UPDATE tasks SET status=$1, completed_at = CASE WHEN $1='done' THEN now() ELSE NULL END
     WHERE id=$2 AND project_id=$3 RETURNING *`, [status, req.params.taskId, req.params.projectId]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ task: rows[0] });
});
