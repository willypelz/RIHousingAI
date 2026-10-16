import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

export const workflowRouter = Router();
workflowRouter.use(requireAuth);

const STAGE_STATUSES = ['pending','active','waiting_on_agency','waiting_on_applicant','complete','skipped'];

/** Update a review stage (status, dates, next action). Due dates require a source. */
workflowRouter.patch('/:projectId/stages/:stageId', requireProjectAccess(), async (req, res) => {
  const { status, submitted_at, verified_due_date, due_date_source_id, next_action } = req.body || {};
  if (status && !STAGE_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (verified_due_date && !due_date_source_id) {
    return res.status(400).json({ error: 'A verified due date requires a due_date_source_id citing the official source that establishes it.' });
  }

  // Block activating a stage whose dependencies are not complete
  if (status === 'active' || status === 'complete') {
    const unmet = await query(
      `SELECT dep.name FROM stage_dependencies sd
       JOIN review_stages dep ON dep.id = sd.depends_on_stage_id
       WHERE sd.stage_id=$1 AND dep.status NOT IN ('complete','skipped')`, [req.params.stageId]);
    if (status === 'complete' && unmet.rows.length) {
      return res.status(409).json({ error: `Cannot complete: depends on incomplete stage(s): ${unmet.rows.map(r => r.name).join(', ')}` });
    }
  }

  const sets: string[] = []; const vals: any[] = [];
  const add = (col: string, v: any) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
  if (status !== undefined) add('status', status);
  if (submitted_at !== undefined) add('submitted_at', submitted_at);
  if (verified_due_date !== undefined) { add('verified_due_date', verified_due_date); add('due_date_source_id', due_date_source_id ?? null); }
  if (next_action !== undefined) add('next_action', next_action);
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  vals.push(req.params.stageId, req.params.projectId);
  const { rows } = await query(
    `UPDATE review_stages rs SET ${sets.join(', ')}
     FROM project_approvals pa
     WHERE rs.id=$${vals.length - 1} AND pa.id=rs.project_approval_id AND pa.project_id=$${vals.length}
     RETURNING rs.*`, vals);
  if (!rows.length) return res.status(404).json({ error: 'Stage not found' });

  // Auto-activate dependent stages whose dependencies are now all complete
  if (status === 'complete') {
    await query(
      `UPDATE review_stages SET status='active'
       WHERE status='pending' AND id IN (
         SELECT sd.stage_id FROM stage_dependencies sd WHERE sd.depends_on_stage_id=$1
       ) AND NOT EXISTS (
         SELECT 1 FROM stage_dependencies sd2 JOIN review_stages dep ON dep.id=sd2.depends_on_stage_id
         WHERE sd2.stage_id = review_stages.id AND dep.status NOT IN ('complete','skipped')
       )`, [req.params.stageId]);
  }

  await audit(req.user!.id, 'stage.update', 'review_stage', req.params.stageId, req.body);
  res.json({ stage: rows[0] });
});

/** Progress & delay overview. Never labels anything overdue without a verified deadline. */
workflowRouter.get('/:projectId/progress', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);

  const approvals = (await query(
    `SELECT pa.id, at.name, at.code, pa.applicability, pa.status, pa.submitted_at, pa.verified_due_date,
            (SELECT count(*) FROM review_stages rs WHERE rs.project_approval_id=pa.id AND rs.status IN ('complete','skipped')) AS stages_done,
            (SELECT count(*) FROM review_stages rs WHERE rs.project_approval_id=pa.id) AS stages_total,
            (SELECT min(rs.submitted_at) FROM review_stages rs WHERE rs.project_approval_id=pa.id AND rs.submitted_at IS NOT NULL) AS first_submission,
            s.processing_estimate
     FROM project_approvals pa JOIN approval_types at ON at.id=pa.approval_type_id
     LEFT JOIN official_sources s ON s.id = at.source_id
     WHERE pa.project_id=$1 AND pa.applicability != 'not_applicable' ORDER BY at.id`, [projectId])).rows;

  const checklist = (await query(
    `SELECT count(*) FILTER (WHERE ci.status='complete') AS done,
            count(*) FILTER (WHERE ci.status NOT IN ('complete','not_applicable')) AS outstanding
     FROM checklist_items ci JOIN project_approvals pa ON pa.id=ci.project_approval_id
     WHERE pa.project_id=$1`, [projectId])).rows[0];

  const waiting = (await query(
    `SELECT rs.id, rs.name, rs.status, rs.responsible_authority, rs.submitted_at,
            at.name AS approval_name,
            CASE WHEN rs.submitted_at IS NOT NULL THEN (CURRENT_DATE - rs.submitted_at) END AS days_elapsed,
            rs.verified_due_date,
            CASE WHEN rs.verified_due_date IS NOT NULL AND CURRENT_DATE > rs.verified_due_date THEN true ELSE false END AS past_verified_due_date
     FROM review_stages rs
     JOIN project_approvals pa ON pa.id=rs.project_approval_id
     JOIN approval_types at ON at.id=pa.approval_type_id
     WHERE pa.project_id=$1 AND rs.status IN ('active','waiting_on_agency','waiting_on_applicant')
     ORDER BY rs.submitted_at NULLS LAST`, [projectId])).rows;

  const tasks = (await query(
    `SELECT * FROM tasks WHERE project_id=$1 AND status='open' ORDER BY created_at`, [projectId])).rows;

  // Bottleneck hints: stages waiting on agency with elapsed time, or blocking many dependents
  const bottlenecks = waiting
    .filter((w: any) => w.status === 'waiting_on_agency')
    .map((w: any) => ({
      stage: w.name, approval: w.approval_name, days_elapsed: w.days_elapsed,
      recommendation: w.past_verified_due_date
        ? 'The verified review deadline has passed — follow up with the responsible authority.'
        : 'Awaiting agency review. Consider a status inquiry with the responsible authority; no verified deadline has been exceeded.',
    }));

  res.json({ approvals, checklist, waiting, tasks, bottlenecks });
});
